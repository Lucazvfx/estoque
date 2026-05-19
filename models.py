from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

def generate_uuid():
    return str(uuid.uuid4())

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Produto(db.Model):
    __tablename__ = 'produtos'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    nome = db.Column(db.String(150), nullable=False)
    sku = db.Column(db.String(50), unique=True, nullable=False)
    agro_tipo = db.Column(db.String(50))
    unidade = db.Column(db.String(10), default='un')
    categoria_id = db.Column(db.String(36), db.ForeignKey('categorias.id'))
    estoque_minimo = db.Column(db.Integer, default=5)
    quantidade = db.Column(db.Float, default=0)  # permite peso decimal
    preco_custo = db.Column(db.Float, default=0)
    preco_venda = db.Column(db.Float, default=0)
    fornecedor = db.Column(db.String(100))
    descricao = db.Column(db.Text)
    imagem_url = db.Column(db.Text)
    controla_validade = db.Column(db.Boolean, default=False)  # NOVO
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    categoria = db.relationship('Categoria', backref='produtos')

class Categoria(db.Model):
    __tablename__ = 'categorias'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    nome = db.Column(db.String(50), nullable=False, unique=True)
    cor = db.Column(db.String(7), default='#888888')

class Lote(db.Model):
    __tablename__ = 'lotes'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    codigo = db.Column(db.String(50), nullable=False)
    produto_id = db.Column(db.String(36), db.ForeignKey('produtos.id'), nullable=False)
    quantidade = db.Column(db.Float, default=0)
    data_fabricacao = db.Column(db.Date)
    data_validade = db.Column(db.Date)
    fornecedor = db.Column(db.String(100))
    observacoes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    produto = db.relationship('Produto', backref='lotes')

class Movimentacao(db.Model):
    __tablename__ = 'movimentacoes'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    produto_id = db.Column(db.String(36), db.ForeignKey('produtos.id'), nullable=False)
    tipo = db.Column(db.String(3), nullable=False)  # 'in' ou 'out'
    quantidade = db.Column(db.Float, nullable=False)
    lote_id = db.Column(db.String(36), db.ForeignKey('lotes.id'))
    motivo = db.Column(db.String(200))
    data = db.Column(db.DateTime, default=datetime.utcnow)

    produto = db.relationship('Produto', backref='movimentacoes')
    lote = db.relationship('Lote', backref='movimentacoes')

class Configuracao(db.Model):
    __tablename__ = 'configuracoes'
    id = db.Column(db.Integer, primary_key=True)
    chave = db.Column(db.String(50), unique=True)
    valor = db.Column(db.Text)

    @staticmethod
    def get(chave, default=None):
        cfg = Configuracao.query.filter_by(chave=chave).first()
        return cfg.valor if cfg else default

    @staticmethod
    def set(chave, valor):
        cfg = Configuracao.query.filter_by(chave=chave).first()
        if cfg:
            cfg.valor = valor
        else:
            cfg = Configuracao(chave=chave, valor=valor)
            db.session.add(cfg)
        db.session.commit()

# ========== NOVAS TABELAS PARA ENTREGAS ==========
class Entrega(db.Model):
    __tablename__ = 'entregas'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    data_saida = db.Column(db.DateTime, default=datetime.utcnow)
    data_prevista = db.Column(db.Date)
    data_real = db.Column(db.Date)
    status = db.Column(db.String(20), default='pendente')  # pendente, transporte, entregue, cancelado
    veiculo = db.Column(db.String(100))
    motorista = db.Column(db.String(100))
    observacoes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    itens = db.relationship('ItemEntrega', backref='entrega', cascade='all, delete-orphan')

class ItemEntrega(db.Model):
    __tablename__ = 'itens_entrega'
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    entrega_id = db.Column(db.String(36), db.ForeignKey('entregas.id'), nullable=False)
    produto_id = db.Column(db.String(36), db.ForeignKey('produtos.id'), nullable=False)
    quantidade = db.Column(db.Float, nullable=False)
    lote_id = db.Column(db.String(36), db.ForeignKey('lotes.id'))

    produto = db.relationship('Produto')
    lote = db.relationship('Lote')