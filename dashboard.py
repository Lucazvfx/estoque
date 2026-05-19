import plotly.express as px
import plotly.utils
import json
import pandas as pd
from datetime import datetime, timedelta
from models import db, Produto, Categoria, Movimentacao

def get_estoque_por_categoria_json():
    """Retorna gráfico de pizza em formato JSON (Plotly)"""
    resultados = db.session.query(
        Categoria.nome,
        db.func.sum(Produto.quantidade).label('total')
    ).outerjoin(Produto).group_by(Categoria.id).all()
    
    df = pd.DataFrame(resultados, columns=['Categoria', 'Quantidade'])
    fig = px.pie(df, values='Quantidade', names='Categoria', title='Estoque por Categoria')
    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)

def get_movimentacoes_30d_json():
    """Gráfico de linhas: entradas e saídas nos últimos 30 dias"""
    data_inicio = datetime.utcnow() - timedelta(days=30)
    movs = Movimentacao.query.filter(Movimentacao.data >= data_inicio).all()
    
    df = pd.DataFrame([{
        'data': m.data.date(),
        'tipo': m.tipo,
        'qtd': m.quantidade
    } for m in movs])
    
    if df.empty:
        return json.dumps({})
    
    pivot = df.pivot_table(index='data', columns='tipo', values='qtd', aggfunc='sum', fill_value=0)
    pivot = pivot.reindex(pd.date_range(data_inicio.date(), datetime.utcnow().date()), fill_value=0)
    pivot.columns = ['Entradas' if c == 'in' else 'Saídas' for c in pivot.columns]
    pivot.index = pivot.index.strftime('%d/%m')
    
    fig = px.line(pivot, markers=True, title='Movimentações (últimos 30 dias)')
    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)

def get_top_produtos_json(limit=10):
    """Top produtos por quantidade em estoque"""
    produtos = Produto.query.order_by(Produto.quantidade.desc()).limit(limit).all()
    df = pd.DataFrame([(p.nome, p.quantidade) for p in produtos], columns=['Produto', 'Estoque'])
    fig = px.bar(df, x='Produto', y='Estoque', title=f'Top {limit} Produtos em Estoque',
                 color='Estoque', color_continuous_scale='Viridis')
    return json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)

# Opcional: previsão de demanda com Prophet (requer fbprophet)
def prever_demanda(produto_id, dias=30):
    """
    Retorna um dicionário com datas e valores previstos.
    Necessita instalar fbprophet.
    """
    try:
        from prophet import Prophet
    except ImportError:
        return {"erro": "Prophet não instalado. Instale com: pip install fbprophet"}
    
    # Busca saídas dos últimos 90 dias
    data_limite = datetime.utcnow() - timedelta(days=90)
    movs = Movimentacao.query.filter(
        Movimentacao.produto_id == produto_id,
        Movimentacao.tipo == 'out',
        Movimentacao.data >= data_limite
    ).order_by(Movimentacao.data).all()
    
    if len(movs) < 7:
        return {"erro": "Dados insuficientes para previsão (mínimo 7 dias de movimento)"}
    
    df = pd.DataFrame([(m.data, m.quantidade) for m in movs], columns=['ds', 'y'])
    modelo = Prophet()
    modelo.fit(df)
    futuro = modelo.make_future_dataframe(periods=dias)
    previsao = modelo.predict(futuro)
    ultimas = previsao[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(dias)
    ultimas['ds'] = ultimas['ds'].dt.strftime('%Y-%m-%d')
    return ultimas.to_dict(orient='records')