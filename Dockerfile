FROM python:3.11-slim

# Instala dependências do sistema (incluindo Tesseract OCR e OpenCV)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-por \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos do projeto
COPY . .

# Instala as dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Expõe a porta que o Render usa
EXPOSE 10000

# Comando para rodar a aplicação
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:10000"]