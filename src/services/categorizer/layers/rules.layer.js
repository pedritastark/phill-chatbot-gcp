class RulesLayer {
    constructor() {
        // Dictionaries (Could be loaded from a JSON file eventually)
        this.dictionaries = {
            'Alimentación': ['crepes', 'corral', 'exito', 'carulla', 'oxxo', 'd1', 'ara', 'restaurante', 'empanada', 'fruteria', 'starbucks', 'juan valdez', 'mcdonalds', 'kfc', 'frisby', 'kokoriko', 'comida', 'latte', 'cafe', 'perro caliente', 'hot dog'],
            'Transporte': ['uber', 'didi', 'cabify', 'taxi', 'metro', 'transmilenio', 'bus', 'gasolina', 'parqueadero', 'peaje', 'taller'],
            'Entretenimiento': ['cine', 'netflix', 'spotify', 'bar', 'discoteca', 'concierto', 'estadio', 'teatro', 'bolera', 'hbo'],
            'Salud': ['drogueria', 'farmatodo', 'cruz verde', 'medico', 'odontologo', 'gimnasio', 'smartfit', 'bodytech', 'eps'],
            'Servicios': ['claro', 'movistar', 'tigo', 'etb', 'enel', 'vanti', 'acueducto', 'luz', 'agua', 'gas', 'internet']
        };
    }

    predict(text) {
        const normalized = text.toLowerCase();

        // 1. Direct Keyword Match
        for (const [category, keywords] of Object.entries(this.dictionaries)) {
            for (const keyword of keywords) {
                // Regex word boundary check for accuracy
                const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                if (regex.test(normalized)) {
                    return {
                        categoria: category,
                        confianza: 0.9, // High confidence for explicit keyword match
                        comercio: keyword, // Guessing rules matched the commerce
                        detalles: { rule_match: keyword }
                    };
                }
            }
        }

        return null;
    }
}

module.exports = RulesLayer;
