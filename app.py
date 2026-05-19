from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import qrcode
from io import BytesIO
import base64

from models import db, Produto, Lote, Movimentacao, Categoria, Configuracao, Entrega, ItemEntrega
from ocr_processor import extract_text_from_image, extract_product_info
from alert_scheduler import start_scheduler, mail
from dashboard import get_estoque_por_categoria_json, get_movimentacoes_30d_json, get_top_produtos_json

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Configurações
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///estoque.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
mail.init_app(app)

with app.app_context():
    db.create_all()
    if not Configuracao.get('dias_alerta_validade'):
        Configuracao.set('dias_alerta_validade', '30')
    if not Configuracao.get('admin_email'):
        Configuracao.set('admin_email', 'admin@exemplo.com')

# Inicia scheduler (alertas automáticos)
scheduler = start_scheduler(app)

# ---------- Produtos ----------
@app.route('/api/produtos', methods=['GET'])
def listar_produtos():
    produtos = Produto.query.all()
    return jsonify([{
        'id': p.id, 'nome': p.nome, 'sku': p.sku, 'quantidade': p.quantidade,
        'preco_venda': p.preco_venda, 'preco_custo': p.preco_custo, 'unidade': p.unidade,
        'estoque_minimo': p.estoque_minimo, 'agro_tipo': p.agro_tipo,
        'categoria_id': p.categoria_id, 'fornecedor': p.fornecedor, 'imagem_url': p.imagem_url,
        'descricao': p.descricao, 'controla_validade': p.controla_validade
    } for p in produtos])

@app.route('/api/produtos', methods=['POST'])
def criar_produto():
    data = request.json
    if Produto.query.filter_by(sku=data['sku']).first():
        return jsonify({'erro': 'SKU já existe'}), 400
    produto = Produto(
        nome=data['nome'], sku=data['sku'], agro_tipo=data.get('agro_tipo'),
        unidade=data.get('unidade', 'un'), categoria_id=data.get('categoria_id'),
        estoque_minimo=data.get('estoque_minimo', 5), preco_custo=data.get('preco_custo', 0),
        preco_venda=data.get('preco_venda', 0), fornecedor=data.get('fornecedor'),
        descricao=data.get('descricao'), imagem_url=data.get('imagem_url'),
        controla_validade=data.get('controla_validade', False)
    )
    db.session.add(produto)
    db.session.commit()
    return jsonify({'id': produto.id}), 201

@app.route('/api/produtos/<id>', methods=['PUT'])
def editar_produto(id):
    produto = Produto.query.get_or_404(id)
    data = request.json
    for key, value in data.items():
        if hasattr(produto, key):
            setattr(produto, key, value)
    db.session.commit()
    return jsonify({'mensagem': 'Atualizado'})

@app.route('/api/produtos/<id>', methods=['DELETE'])
def deletar_produto(id):
    produto = Produto.query.get_or_404(id)
    db.session.delete(produto)
    db.session.commit()
    return jsonify({'mensagem': 'Removido'})

# ---------- QR Code (backend) ----------
@app.route('/api/produtos/<id>/qrcode', methods=['GET'])
def gerar_qrcode_produto(id):
    produto = Produto.query.get_or_404(id)
    qr_data = f"PROD:{produto.id}|{produto.nome}|{produto.sku}|{produto.preco_venda}"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=5, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    return jsonify({
        'qr_base64': img_base64,
        'nome': produto.nome,
        'sku': produto.sku,
        'preco': produto.preco_venda
    })

# ---------- Lotes ----------
@app.route('/api/produtos/<id>/lotes', methods=['GET'])
def listar_lotes_do_produto(id):
    produto = Produto.query.get_or_404(id)
    if not produto.controla_validade:
        return jsonify([])
    lotes = Lote.query.filter_by(produto_id=id).filter(Lote.quantidade > 0).all()
    return jsonify([{
        'id': l.id, 'codigo': l.codigo, 'quantidade': l.quantidade,
        'data_validade': l.data_validade.isoformat() if l.data_validade else None
    } for l in lotes])

@app.route('/api/lotes', methods=['GET'])
def listar_lotes():
    lotes = Lote.query.all()
    return jsonify([{
        'id': l.id, 'codigo': l.codigo, 'produto_id': l.produto_id,
        'quantidade': l.quantidade, 'data_fabricacao': l.data_fabricacao.isoformat() if l.data_fabricacao else None,
        'data_validade': l.data_validade.isoformat() if l.data_validade else None,
        'fornecedor': l.fornecedor, 'observacoes': l.observacoes,
        'produto': {'id': l.produto.id, 'nome': l.produto.nome}
    } for l in lotes])

@app.route('/api/lotes', methods=['POST'])
def criar_lote():
    data = request.json
    lote = Lote(
        codigo=data['codigo'], produto_id=data['produto_id'],
        quantidade=data['quantidade'], data_fabricacao=data.get('data_fabricacao'),
        data_validade=data.get('data_validade'), fornecedor=data.get('fornecedor'),
        observacoes=data.get('observacoes')
    )
    db.session.add(lote)
    db.session.commit()
    produto = Produto.query.get(data['produto_id'])
    produto.quantidade = sum(l.quantidade for l in produto.lotes)
    db.session.commit()
    return jsonify({'id': lote.id}), 201

@app.route('/api/lotes/<id>', methods=['PUT'])
def editar_lote(id):
    lote = Lote.query.get_or_404(id)
    data = request.json
    for key, value in data.items():
        if hasattr(lote, key):
            setattr(lote, key, value)
    db.session.commit()
    produto = Produto.query.get(lote.produto_id)
    produto.quantidade = sum(l.quantidade for l in produto.lotes)
    db.session.commit()
    return jsonify({'mensagem': 'Atualizado'})

@app.route('/api/lotes/<id>', methods=['DELETE'])
def deletar_lote(id):
    lote = Lote.query.get_or_404(id)
    produto_id = lote.produto_id
    db.session.delete(lote)
    db.session.commit()
    produto = Produto.query.get(produto_id)
    produto.quantidade = sum(l.quantidade for l in produto.lotes)
    db.session.commit()
    return jsonify({'mensagem': 'Removido'})

# ---------- Movimentações (com validação de validade) ----------
@app.route('/api/movimentacoes', methods=['POST'])
def registrar_movimentacao():
    data = request.json
    produto = Produto.query.get_or_404(data['produto_id'])
    quantidade = float(data['quantidade'])
    tipo = data['tipo']
    lote_id = data.get('lote_id')
    motivo = data.get('motivo', '')

    if tipo == 'out':
        if produto.controla_validade:
            if not lote_id:
                return jsonify({'erro': 'Produto controla validade, informe o lote'}), 400
            lote = Lote.query.get_or_404(lote_id)
            if lote.data_validade and lote.data_validade < datetime.utcnow().date():
                return jsonify({'erro': f'Lote {lote.codigo} está vencido'}), 400
            if lote.quantidade < quantidade:
                return jsonify({'erro': f'Estoque insuficiente no lote (disponível: {lote.quantidade})'}), 400
            lote.quantidade -= quantidade
            produto.quantidade -= quantidade
        else:
            if produto.quantidade < quantidade:
                return jsonify({'erro': 'Estoque insuficiente'}), 400
            produto.quantidade -= quantidade
    else:  # tipo == 'in'
        if produto.controla_validade and lote_id:
            lote = Lote.query.get_or_404(lote_id)
            lote.quantidade += quantidade
            produto.quantidade += quantidade
        else:
            produto.quantidade += quantidade

    mov = Movimentacao(
        produto_id=produto.id, tipo=tipo, quantidade=quantidade,
        lote_id=lote_id, motivo=motivo
    )
    db.session.add(mov)
    db.session.commit()
    return jsonify({'mensagem': 'Movimentação registrada'})

@app.route('/api/movimentacoes', methods=['GET'])
def listar_movimentacoes():
    movs = Movimentacao.query.order_by(Movimentacao.data.desc()).limit(200).all()
    return jsonify([{
        'id': m.id, 'produto_id': m.produto_id, 'tipo': m.tipo,
        'quantidade': m.quantidade, 'motivo': m.motivo,
        'data': m.data.isoformat(), 'produto_nome': m.produto.nome,
        'lote_codigo': m.lote.codigo if m.lote else None
    } for m in movs])

# ---------- Categorias ----------
@app.route('/api/categorias', methods=['GET'])
def listar_categorias():
    categorias = Categoria.query.all()
    return jsonify([{'id': c.id, 'nome': c.nome, 'cor': c.cor} for c in categorias])

@app.route('/api/categorias', methods=['POST'])
def criar_categoria():
    data = request.json
    if Categoria.query.filter_by(nome=data['nome']).first():
        return jsonify({'erro': 'Categoria já existe'}), 400
    categoria = Categoria(nome=data['nome'], cor=data.get('cor', '#888888'))
    db.session.add(categoria)
    db.session.commit()
    return jsonify({'id': categoria.id}), 201

@app.route('/api/categorias/<id>', methods=['PUT'])
def editar_categoria(id):
    categoria = Categoria.query.get_or_404(id)
    data = request.json
    categoria.nome = data.get('nome', categoria.nome)
    categoria.cor = data.get('cor', categoria.cor)
    db.session.commit()
    return jsonify({'mensagem': 'Atualizado'})

@app.route('/api/categorias/<id>', methods=['DELETE'])
def deletar_categoria(id):
    categoria = Categoria.query.get_or_404(id)
    db.session.delete(categoria)
    db.session.commit()
    return jsonify({'mensagem': 'Removido'})

# ---------- OCR Avançado ----------
@app.route('/api/ocr-avancado', methods=['POST'])
def ocr_avancado():
    if 'imagem' not in request.files:
        return jsonify({'erro': 'Nenhuma imagem enviada'}), 400
    file = request.files['imagem']
    image_bytes = file.read()
    try:
        texto = extract_text_from_image(image_bytes, lang='por')
        info = extract_product_info(texto)
        produtos = Produto.query.filter(
            Produto.nome.ilike(f'%{texto}%') | Produto.sku.ilike(f'%{texto}%')
        ).limit(10).all()
        resultado_produtos = [{'id': p.id, 'nome': p.nome, 'sku': p.sku, 'quantidade': p.quantidade} for p in produtos]
        return jsonify({
            'texto_extraido': texto,
            'info_adicional': info,
            'produtos_encontrados': resultado_produtos
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# ---------- Dashboards ----------
@app.route('/api/dashboard/estoque-categoria', methods=['GET'])
def dashboard_estoque_categoria():
    return get_estoque_por_categoria_json()

@app.route('/api/dashboard/movimentacoes-30d', methods=['GET'])
def dashboard_movimentacoes():
    return get_movimentacoes_30d_json()

@app.route('/api/dashboard/top-produtos', methods=['GET'])
def dashboard_top_produtos():
    return get_top_produtos_json()

# ---------- Entregas ----------
@app.route('/api/entregas', methods=['GET'])
def listar_entregas():
    entregas = Entrega.query.order_by(Entrega.data_saida.desc()).all()
    result = []
    for e in entregas:
        itens = []
        for item in e.itens:
            itens.append({
                'produto_nome': item.produto.nome if item.produto else '-',
                'quantidade': item.quantidade,
                'lote_codigo': item.lote.codigo if item.lote else None
            })
        result.append({
            'id': e.id,
            'data_saida': e.data_saida.isoformat(),
            'data_prevista': e.data_prevista.isoformat() if e.data_prevista else None,
            'data_real': e.data_real.isoformat() if e.data_real else None,
            'status': e.status,
            'veiculo': e.veiculo,
            'motorista': e.motorista,
            'observacoes': e.observacoes,
            'itens': itens
        })
    return jsonify(result)

@app.route('/api/entregas', methods=['POST'])
def criar_entrega():
    data = request.json
    entrega = Entrega(
        data_prevista=data.get('data_prevista'),
        veiculo=data.get('veiculo'),
        motorista=data.get('motorista'),
        observacoes=data.get('observacoes')
    )
    db.session.add(entrega)
    db.session.commit()
    for item in data.get('itens', []):
        item_entrega = ItemEntrega(
            entrega_id=entrega.id,
            produto_id=item['produto_id'],
            quantidade=item['quantidade'],
            lote_id=item.get('lote_id')
        )
        db.session.add(item_entrega)
    db.session.commit()
    return jsonify({'id': entrega.id}), 201

@app.route('/api/entregas/<id>', methods=['PUT'])
def atualizar_entrega(id):
    entrega = Entrega.query.get_or_404(id)
    data = request.json
    if 'status' in data:
        entrega.status = data['status']
    if 'data_real' in data:
        entrega.data_real = data['data_real']
    db.session.commit()
    return jsonify({'mensagem': 'Entrega atualizada'})

# ---------- Configurações ----------
@app.route('/api/configuracoes', methods=['GET'])
def get_configuracoes():
    return jsonify({
        'dias_alerta_validade': Configuracao.get('dias_alerta_validade', '30'),
        'admin_email': Configuracao.get('admin_email', 'admin@exemplo.com')
    })

@app.route('/api/configuracoes', methods=['POST'])
def set_configuracoes():
    data = request.json
    if 'dias_alerta_validade' in data:
        Configuracao.set('dias_alerta_validade', str(data['dias_alerta_validade']))
    if 'admin_email' in data:
        Configuracao.set('admin_email', data['admin_email'])
    return jsonify({'mensagem': 'Configurações salvas'})

# ---------- Servir frontend ----------
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)