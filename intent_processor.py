#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sistema de procesamiento de intents y entities para Phill Chatbot.
Reemplaza completamente la funcionalidad de Dialogflow.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any

class IntentProcessor:
    """Procesador de intents y entities basado en la configuración de Dialogflow."""
    
    def __init__(self):
        # Patrones para detectar intents basados en las training phrases reales
        # Ordenados por especificidad (más específicos primero)
        self.intent_patterns = {
            'registrar_gasto': [
                # Patrones específicos primero
                r'registr[ao]r?\s+una\s+compra|registr[ao]r?\s+un\s+gasto',
                r'registr[ao]r?\s+gasto\s+de|registr[ao]r?\s+compra\s+de',
                r'porfa\s+registr[ao]r?\s+gasto|quiero\s+registr[ao]r?\s+gasto',
                r'anota\s+una\s+transferencia|transfer[íi]\s+\d+',
                r'el\s+\w+\s+de\s+anoche\s+cost[óo]|el\s+\w+\s+de\s+cumpleaños\s+me\s+cost[óo]',
                r'pagué\s+la\s+cuota\s+del|se\s+me\s+fue\s+la\s+mano',
                r'oye\s+anota|hoy\s+tuve\s+un\s+gasto',
                r'apunta\s+un\s+pago|apunta\s+\d+|apunta\s+\d+\s+de',
                r'salieron\s+\d+|necesito\s+registrar',
                r'se\s+fueron\s+\d+|se\s+me\s+fueron\s+\d+',
                r'tuve\s+un\s+gasto|tuve\s+una\s+salida',
                r'un\s+gasto\s+de\s+\w+|un\s+egreso\s+de',
                r'salida\s+de\s+dinero|salida\s+de\s+plata',
                # Patrones generales
                r'gast[eo]|gasté|gastar',
                r'compr[eo]|compré|comprar',
                r'pagu[eo]|pagué|pagar',
                r'egreso|transfer[íi]|transferí',
                r'el\s+\w+\s+me\s+cost[óo]|el\s+\w+\s+cost[óo]',
                r'anot[ao]r?\s+gasto|anot[ao]r?\s+pago',
                r'apunt[ao]r?\s+gasto|apunt[ao]r?\s+pago'
            ],
            'registrar_ingreso': [
                # Patrones específicos
                r'me\s+ingres[óo]\s+\d+|ingres[óo]\s+como',
                r'plata\s+que\s+me\s+lleg[óo]|me\s+entr[óo]\s+\d+',
                r'registr[ao]r?\s+ingreso|anot[ao]r?\s+ingreso',
                r'recib[íi]\s+\d+|gan[eo]\s+\d+',
                r'me\s+ingres[óo]|ingres[óo]\s+como\s+regalo',
                # Patrones generales
                r'ingres[eo]|ingresé|ingresar',
                r'gan[eo]|gané|ganar',
                r'recib[íi]|recibí|recibir',
                r'platica'
            ],
            'solicitar_resumen': [
                # Patrones específicos
                r'quiero\s+ver\s+mi\s+resumen|ver\s+mi\s+resumen',
                r'mostr[ao]r?\s+gastos\s+del\s+mes|gastos\s+del\s+mes',
                r'cu[áa]nto\s+he\s+gastado\s+este\s+mes',
                r'mostr[ao]r?\s+cu[áa]nto\s+gast[eo]',
                # Patrones generales
                r'resumen|resumir',
                r'ver\s+gastos|mostr[ao]r?\s+gastos',
                r'cu[áa]nto\s+gast[eo]|cu[áa]nto\s+he\s+gastado',
                r'cu[áa]nto\s+me\s+he\s+gastado'
            ],
            'consultar_balance': [
                # Patrones específicos
                r'ingresos\s+vs\s+gastos|ingresos\s+menos\s+gastos',
                r'cu[áa]nto\s+me\s+queda\s+en\s+total|balance\s+total',
                r'cu[áa]l\s+es\s+mi\s+balance|mi\s+balance',
                # Patrones generales
                r'balance|balanza',
                r'cu[áa]nto\s+tengo|cu[áa]nto\s+me\s+queda',
                r'diferencia|sobrante|faltante'
            ],
            'solicitar_tip': [
                # Patrones específicos
                r'dame\s+un\s+consejo|dame\s+un\s+tip',
                r'qu[ée]\s+me\s+recomiendas|qu[ée]\s+recomiendas',
                r'ay[úu]dame\s+con\s+mis\s+finanzas',
                # Patrones generales
                r'consejo|tip|tips',
                r'ayuda|ay[úu]dame',
                r'qu[ée]\s+hago|como\s+ahorrar',
                r'como\s+gestionar|como\s+manejar',
                r'recomendaci[óo]n|sugerencia',
                r'me\s+ayudas'
            ],
            'crear_recordatorio': [
                # Patrones específicos
                r'recu[ée]rdame\s+pagar|recu[ée]rdame\s+el\s+\d+',
                r'avis[ao]r?me\s+el\s+\d+|avis[ao]r?me\s+ma[ñn]ana',
                r'el\s+\d+\s+de\s+\w+|para\s+el\s+\d+',
                r'notific[ao]r?me\s+sobre|alarm[ao]r?me\s+sobre',
                # Patrones generales
                r'record[ao]r?|recordarme|recordatorio',
                r'avis[ao]r?|avisarme|aviso',
                r'notific[ao]r?|notificarme',
                r'alarm[ao]r?|alarmarme',
                r'ma[ñn]ana|hoy|pasado\s+ma[ñn]ana'
            ],
            'analisis_detallado': [
                # Patrones específicos
                r'hazme\s+un\s+an[áa]lisis|an[áa]lisis\s+detallado',
                r'c[óo]mo\s+estoy\s+financieramente|mi\s+situaci[óo]n\s+financiera',
                # Patrones generales
                r'an[áa]lisis|analizar',
                r'detall[ao]|completo',
                r'estad[íi]sticas|estadisticas',
                r'c[óo]mo\s+estoy|mi\s+situaci[óo]n',
                r'evaluaci[óo]n|evaluar'
            ]
        }
        
        # Categorías de gastos basadas en la configuración exportada
        self.categoria_gasto = {
            'Alimentación': [
                'alimentación', 'comida', 'almuerzo', 'cena', 'desayuno',
                'restaurante', 'corrientazo', 'domicilios', 'rappi',
                'cafetería', 'café', 'tinto', 'mercado', 'mercar'
            ],
            'Supermercado': [
                'supermercado', 'mercado', 'mercar', 'víveres', 'compras',
                'plaza', 'super', 'tienda', 'd1', 'ara', 'éxito', 'jumbo', 'olímpica'
            ],
            'Transporte': [
                'transporte', 'movilidad', 'bus', 'transmilenio', 'taxi',
                'uber', 'didi', 'gasolina', 'combustible', 'peaje',
                'parqueadero', 'pasajes'
            ],
            'Vivienda': [
                'vivienda', 'arriendo', 'alquiler', 'hipoteca', 'administración',
                'servicios públicos', 'agua', 'luz', 'gas', 'internet',
                'wifi', 'televisión por cable', 'factura'
            ],
            'Suscripciones y Apps': [
                'suscripciones y apps', 'netflix', 'spotify', 'disney+', 'hbo',
                'prime video', 'youtube premium', 'plan de celular', 'datos',
                'recarga', 'apps', 'software'
            ],
            'Salud y Bienestar': [
                'salud y bienestar', 'eps', 'medicina prepagada', 'cita médica',
                'medicamentos', 'farmacia', 'droguería', 'gimnasio', 'gym',
                'suplementos', 'vitaminas'
            ],
            'Compras': [
                'compras', 'ropa', 'zapatos', 'tecnología', 'accesorios',
                'regalos', 'detalles'
            ],
            'Ocio y Entretenimiento': [
                'ocio y entretenimiento', 'cine', 'conciertos', 'fiesta',
                'rumba', 'bar', 'paseo', 'hobbies', 'videojuegos', 'libros'
            ],
            'Educación': [
                'educación', 'universidad', 'colegio', 'matrícula', 'curso',
                'diplomado', 'libros de estudio', 'útiles escolares'
            ],
            'Finanzas': [
                'finanzas', 'cuota de crédito', 'pago de tarjeta', 'préstamo',
                'deuda', 'transferencia', 'nequi', 'daviplata', 'comisiones bancarias'
            ],
            'Ahorro e Inversión': [
                'ahorro e inversión', 'ahorro', 'inversión', 'cdt', 'acciones',
                'criptomonedas', 'bitcoin'
            ],
            'Mascotas': [
                'mascotas', 'comida de mascota', 'concentrado', 'veterinario',
                'vacunas', 'juguetes para mascota', 'perro', 'gato'
            ],
            'Viajes': [
                'viajes', 'tiquetes', 'vuelos', 'hotel', 'airbnb', 'vacaciones'
            ],
            'Cuidado Personal': [
                'cuidado personal', 'peluquería', 'barbería', 'spa', 'uñas', 'maquillaje'
            ],
            'Otros Gastos': [
                'otros gastos', 'imprevistos', 'emergencias', 'donaciones', 'varios'
            ]
        }
        
        # Tipos de ingresos
        self.tipo_ingreso = {
            'Salario': ['salario', 'sueldo', 'pago', 'trabajo', 'nómina'],
            'Venta': ['venta', 'negocio', 'emprendimiento', 'rebusque'],
            'Inversión': ['inversión', 'dividendos', 'intereses', 'rendimientos'],
            'Regalo': ['regalo', 'donación', 'ayuda', 'prestado'],
            'Otros Ingresos': ['otros', 'varios', 'misceláneos', 'extra']
        }
        
        # Mapeo de meses
        self.meses = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        }
    
    def detect_intent(self, message: str) -> Tuple[str, float]:
        """
        Detecta la intención del mensaje basado en patrones.
        
        Args:
            message: Mensaje del usuario
            
        Returns:
            Tuple con (intent_name, confidence)
        """
        message_lower = message.lower().strip()
        
        # Calcular puntuación para cada intent
        intent_scores = {}
        for intent, patterns in self.intent_patterns.items():
            score = 0
            pattern_count = 0
            
            for i, pattern in enumerate(patterns):
                matches = re.findall(pattern, message_lower, re.IGNORECASE)
                if matches:
                    pattern_count += 1
                    # Dar más peso a patrones más específicos (los primeros en la lista)
                    weight = 3 if i < 5 else 2 if i < 10 else 1
                    score += len(matches) * weight
                    
                    # Bonus extra por patrones muy específicos
                    if len(pattern) > 20:  # Patrones largos son más específicos
                        score += 2
            
            if score > 0:
                # Bonus por tener múltiples patrones coincidentes
                if pattern_count > 1:
                    score += pattern_count
                intent_scores[intent] = score
        
        # Retornar el intent con mayor puntuación
        if intent_scores:
            best_intent = max(intent_scores, key=intent_scores.get)
            max_score = max(intent_scores.values())
            confidence = min(max_score / 15.0, 1.0)  # Normalizar confianza
            
            # Si hay empate, dar prioridad a intents más específicos
            tied_intents = [intent for intent, score in intent_scores.items() if score == max_score]
            if len(tied_intents) > 1:
                # Priorizar intents en este orden
                priority_order = ['crear_recordatorio', 'consultar_balance', 'solicitar_resumen', 
                                'solicitar_tip', 'analisis_detallado', 'registrar_ingreso', 'registrar_gasto']
                for priority_intent in priority_order:
                    if priority_intent in tied_intents:
                        best_intent = priority_intent
                        break
            
            return best_intent, confidence
        
        return 'default', 0.0
    
    def extract_entities(self, message: str, intent: str) -> Dict[str, Any]:
        """
        Extrae entities del mensaje basado en la intención detectada.
        
        Args:
            message: Mensaje del usuario
            intent: Intención detectada
            
        Returns:
            Diccionario con las entidades extraídas
        """
        entities = {}
        message_lower = message.lower()
        
        # Extraer monto (para gastos e ingresos)
        if intent in ['registrar_gasto', 'registrar_ingreso']:
            monto = self._extract_monto(message)
            if monto:
                entities['monto'] = monto
        
        # Extraer categoría (para gastos)
        if intent == 'registrar_gasto':
            categoria = self._extract_categoria(message)
            if categoria:
                entities['categoria'] = categoria
        
        # Extraer tipo (para ingresos)
        if intent == 'registrar_ingreso':
            tipo = self._extract_tipo_ingreso(message)
            if tipo:
                entities['tipo'] = tipo
        
        # Extraer fecha y motivo (para recordatorios)
        if intent == 'crear_recordatorio':
            fecha = self._extract_fecha(message)
            if fecha:
                entities['fecha'] = fecha
            
            motivo = self._extract_motivo(message)
            if motivo:
                entities['motivo'] = motivo
        
        return entities
    
    def _extract_monto(self, message: str) -> Optional[int]:
        """Extrae el monto del mensaje."""
        # Patrones para diferentes formatos de monto (ordenados por especificidad)
        patterns = [
            # Patrones específicos con palabras
            r'(\d+)\s*(?:mil\s+pesos?|k\s+pesos?)',  # 5 mil pesos o 5k pesos
            r'(\d+)\s*(?:millones?\s+de\s+pesos?)',  # 2 millones de pesos
            r'(\d+)\s*(?:millones?|mill[óo]n)',  # 2 millones
            r'(\d+)\s*(?:mil|k)',  # 5 mil o 5k
            
            # Patrones con símbolo de moneda
            r'\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)',  # $1,000.00 o $1.000,00
            r'\$\s*(\d+(?:[.,]\d{2})?)',  # $100.50 o $100,50
            r'\$\s*(\d+)',  # $100
            
            # Patrones sin símbolo
            r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)',  # 1,000.00 o 1.000,00
            r'(\d+(?:[.,]\d{2})?)',  # 100.50 o 100,50
            r'(\d+)\s*pesos?',  # 100 pesos
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            if matches:
                monto_str = matches[0]
                
                # Limpiar y convertir el monto
                monto_clean = re.sub(r'[^\d.,]', '', monto_str)
                
                # Manejar diferentes formatos
                if ',' in monto_clean and '.' in monto_clean:
                    # Formato: 1,000.50
                    monto_clean = monto_clean.replace(',', '')
                elif ',' in monto_clean:
                    # Formato: 1.000,50 o 1,000
                    if len(monto_clean.split(',')[-1]) <= 2:
                        monto_clean = monto_clean.replace(',', '.')
                    else:
                        monto_clean = monto_clean.replace(',', '')
                elif '.' in monto_clean:
                    # Formato: 1.000 (miles) o 1.50 (decimales)
                    parts = monto_clean.split('.')
                    if len(parts) == 2:
                        if len(parts[1]) <= 2:
                            # Es decimal: 1.50
                            pass
                        else:
                            # Es miles: 1.000
                            monto_clean = monto_clean.replace('.', '')
                
                try:
                    monto_num = int(float(monto_clean))
                    
                    # Aplicar multiplicadores si hay palabras clave en el mensaje original
                    if re.search(r'(?:millones?\s+de\s+pesos?|millones?|mill[óo]n)', message, re.IGNORECASE):
                        monto_num *= 1000000
                    elif re.search(r'(?:mil\s+pesos?|mil|k)', message, re.IGNORECASE):
                        monto_num *= 1000
                    
                    return monto_num
                except ValueError:
                    continue
        
        return None
    
    def _extract_categoria(self, message: str) -> Optional[str]:
        """Extrae la categoría del gasto del mensaje."""
        message_lower = message.lower()
        
        # Patrones de contexto específicos (más precisos)
        context_patterns = {
            'Finanzas': [
                r'pago\s+de\s+tarjeta', r'cuota\s+de\s+cr[ée]dito', r'transferencia\s+a\s+nequi',
                r'transferencia\s+a\s+daviplata', r'pago\s+de\s+tarjeta', r'comisiones\s+bancarias',
                r'pago\s+de\s+la\s+tarjeta', r'del\s+pago\s+de\s+la\s+tarjeta'
            ],
            'Salud y Bienestar': [
                r'gasto\s+en\s+la\s+farmacia', r'en\s+la\s+farmacia', r'medicina', r'gimnasio',
                r'cuota\s+del\s+gimnasio', r'gym', r'medicamentos', r'droguería'
            ],
            'Vivienda': [
                r'factura\s+de\s+la\s+luz', r'pago\s+del\s+arriendo', r'servicios\s+públicos',
                r'administraci[óo]n', r'hipoteca', r'alquiler'
            ],
            'Transporte': [
                r'parqueadero', r'gasolina', r'combustible', r'peaje', r'pasajes',
                r'uber', r'taxi', r'transmilenio'
            ],
            'Alimentación': [
                r'corrientazo', r'domicilios', r'rappi', r'cafetería', r'tinto',
                r'almuerzo', r'cena', r'desayuno', r'restaurante'
            ],
            'Ocio y Entretenimiento': [
                r'cine', r'fiesta', r'rumba', r'bar', r'paseo', r'conciertos'
            ],
            'Compras': [
                r'ropa', r'zapatos', r'tecnología', r'accesorios', r'regalos'
            ],
            'Mascotas': [
                r'comida\s+del\s+perro', r'comida\s+de\s+mascota', r'veterinario',
                r'concentrado', r'vacunas'
            ]
        }
        
        # Primero buscar patrones de contexto específicos
        for categoria, patterns in context_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    return categoria
        
        # Si no hay contexto específico, buscar sinónimos directos
        categoria_matches = []
        
        for categoria, sinonimos in self.categoria_gasto.items():
            for sinonimo in sinonimos:
                if sinonimo.lower() in message_lower:
                    categoria_matches.append((categoria, len(sinonimo)))
        
        if categoria_matches:
            # Retornar la categoría con el sinónimo más largo (más específico)
            categoria_matches.sort(key=lambda x: x[1], reverse=True)
            return categoria_matches[0][0]
        
        return None
    
    def _extract_tipo_ingreso(self, message: str) -> Optional[str]:
        """Extrae el tipo de ingreso del mensaje."""
        message_lower = message.lower()
        
        # Buscar cada tipo y sus sinónimos
        for tipo, sinonimos in self.tipo_ingreso.items():
            for sinonimo in sinonimos:
                if sinonimo.lower() in message_lower:
                    return tipo
        
        return None
    
    def _extract_fecha(self, message: str) -> Optional[str]:
        """Extrae la fecha del mensaje."""
        message_lower = message.lower()
        
        # Patrones para fechas
        patterns = [
            # Formato: día de mes
            r'(?:el|para\s+el)\s+(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)',
            # Formato: día/mes
            r'(?:el|para\s+el)\s+(\d{1,2})/(\d{1,2})',
            # Formato: día-mes
            r'(?:el|para\s+el)\s+(\d{1,2})-(\d{1,2})',
            # Fechas relativas
            r'(ma[ñn]ana|hoy|pasado\s+ma[ñn]ana)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, message_lower, re.IGNORECASE)
            if matches:
                if isinstance(matches[0], tuple):
                    # Formato: día/mes o día-mes
                    if len(matches[0]) == 2:
                        dia, mes = matches[0]
                        try:
                            dia = int(dia)
                            mes = int(mes)
                            year = datetime.now().year
                            return datetime(year, mes, dia).isoformat()
                        except ValueError:
                            continue
                else:
                    # Formato: día de mes
                    if len(matches[0]) == 2:
                        dia, mes_nombre = matches[0]
                        try:
                            dia = int(dia)
                            mes = self.meses.get(mes_nombre.lower())
                            if mes:
                                year = datetime.now().year
                                return datetime(year, mes, dia).isoformat()
                        except ValueError:
                            continue
                    else:
                        # Fechas relativas
                        fecha_rel = matches[0].lower()
                        now = datetime.now()
                        
                        if fecha_rel == 'hoy':
                            return now.isoformat()
                        elif fecha_rel == 'mañana':
                            return (now + timedelta(days=1)).isoformat()
                        elif fecha_rel == 'pasado mañana':
                            return (now + timedelta(days=2)).isoformat()
        
        return None
    
    def _extract_motivo(self, message: str) -> Optional[str]:
        """Extrae el motivo del recordatorio."""
        # Patrones para extraer el motivo
        patterns = [
            r'recu[ée]rdame\s+(.+?)(?:\s+el\s+\d|\s+ma[ñn]ana|\s+hoy|$)',
            r'avis[ao]r?me\s+(?:sobre\s+)?(.+?)(?:\s+el\s+\d|\s+ma[ñn]ana|\s+hoy|$)',
            r'notific[ao]r?me\s+(?:sobre\s+)?(.+?)(?:\s+el\s+\d|\s+ma[ñn]ana|\s+hoy|$)',
            r'(?:pagar|pago|factura|cuota|deuda)\s+(.+?)(?:\s+el\s+\d|\s+ma[ñn]ana|\s+hoy|$)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            if matches:
                motivo = matches[0].strip()
                if motivo and len(motivo) > 2:  # Evitar motivos muy cortos
                    return motivo
        
        # Si no se encuentra con patrones específicos, buscar palabras clave
        message_lower = message.lower()
        if 'pagar' in message_lower:
            return 'pago pendiente'
        elif 'factura' in message_lower:
            return 'factura'
        elif 'cuota' in message_lower:
            return 'cuota'
        
        return None

# Instancia global del procesador
intent_processor = IntentProcessor()
