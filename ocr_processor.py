import cv2
import numpy as np
import pytesseract
import re
from PIL import Image
import io

def preprocess_image(image_bytes):
    # Carrega imagem a partir dos bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Imagem inválida")
    
    # Redimensiona se for muito grande (otimização)
    height, width = img.shape[:2]
    if width > 1200:
        scale = 1200 / width
        new_width = 1200
        new_height = int(height * scale)
        img = cv2.resize(img, (new_width, new_height))
    
    # Escala de cinza
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Remoção de ruído (bilateral preserva bordas)
    blurred = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # Binarização adaptativa (melhor para iluminação não uniforme)
    binary = cv2.adaptiveThreshold(blurred, 255,
                                   cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 11, 2)
    
    # Operações morfológicas para conectar partes das letras
    kernel = np.ones((2, 2), np.uint8)
    dilated = cv2.dilate(binary, kernel, iterations=1)
    eroded = cv2.erode(dilated, kernel, iterations=1)
    
    return eroded

def extract_text_from_image(image_bytes, lang='por'):
    """
    Retorna o texto reconhecido na imagem.
    """
    processed = preprocess_image(image_bytes)
    # Configuração: modo de linha única (PSM 7) + modo LSTM (OEM 3)
    custom_config = f'--oem 3 --psm 6 -l {lang}'
    text = pytesseract.image_to_string(processed, config=custom_config)
    # Limpeza: remove múltiplos espaços, caracteres não alfanuméricos estranhos
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_product_info(text):
    """
    Tenta extrair nome, lote e validade do texto (exemplo simples).
    Pode ser expandido com regex específicos para agro.
    """
    # Exemplo: procura padrões de data (dd/mm/aaaa)
    date_pattern = r'\b\d{2}[/-]\d{2}[/-]\d{4}\b'
    dates = re.findall(date_pattern, text)
    # Remove datas do texto principal
    text_clean = re.sub(date_pattern, '', text).strip()
    return {
        'texto_completo': text,
        'possiveis_datas': dates,
        'texto_sem_datas': text_clean
    }