from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from flask_mail import Mail, Message
import requests
from models import db, Produto, Lote, Configuracao

# Configurações (substitua pelos seus dados)
TELEGRAM_BOT_TOKEN = "SEU_TOKEN"
TELEGRAM_CHAT_ID = "SEU_CHAT_ID"

# E-mail (Flask-Mail será configurado no app)
mail = Mail()

def enviar_telegram(mensagem):
    if TELEGRAM_BOT_TOKEN == "SEU_TOKEN":
        print("[ALERTA] Telegram não configurado. Mensagem:", mensagem)
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={'chat_id': TELEGRAM_CHAT_ID, 'text': mensagem}, timeout=5)
    except Exception as e:
        print(f"Erro ao enviar Telegram: {e}")

def enviar_email(destinatario, assunto, corpo):
    try:
        msg = Message(assunto, recipients=[destinatario])
        msg.body = corpo
        mail.send(msg)
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")

def tarefa_alertas(app):
    with app.app_context():
        # 1. Estoque baixo
        produtos_baixos = Produto.query.filter(Produto.quantidade <= Produto.estoque_minimo).all()
        if produtos_baixos:
            corpo = "⚠️ *PRODUTOS COM ESTOQUE BAIXO* ⚠️\n\n"
            for p in produtos_baixos:
                corpo += f"• {p.nome} (SKU: {p.sku}): {p.quantidade} {p.unidade} (mínimo {p.estoque_minimo})\n"
            enviar_telegram(corpo)
            # Envia e-mail para o primeiro admin (configurável)
            admin_email = Configuracao.get('admin_email', 'admin@exemplo.com')
            enviar_email(admin_email, 'Alerta de Estoque Baixo', corpo)
        
        # 2. Lotes próximos do vencimento (dias configuráveis)
        dias_aviso = int(Configuracao.get('dias_alerta_validade', '30'))
        data_limite = datetime.utcnow() + timedelta(days=dias_aviso)
        lotes_vencendo = Lote.query.filter(Lote.data_validade <= data_limite,
                                           Lote.data_validade >= datetime.utcnow()).all()
        if lotes_vencendo:
            corpo = "⏰ *LOTES PRÓXIMOS DO VENCIMENTO* ⏰\n\n"
            for l in lotes_vencendo:
                dias_rest = (l.data_validade - datetime.utcnow().date()).days
                corpo += f"• Lote {l.codigo} de {l.produto.nome} vence em {l.data_validade.strftime('%d/%m/%Y')} (em {dias_rest} dias)\n"
            enviar_telegram(corpo)

def start_scheduler(app):
    scheduler = BackgroundScheduler()
    # Agendar para rodar todos os dias às 08:00
    scheduler.add_job(func=lambda: tarefa_alertas(app), trigger="cron", hour=8, minute=0)
    scheduler.start()
    return scheduler