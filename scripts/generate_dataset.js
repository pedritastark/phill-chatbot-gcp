const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_FILE = path.join(__dirname, '../data/dataset_v1.json');
const TARGET_COUNT = 200;

// Data Pools (Colombia Context)
const CATEGORIES = [
    'Alimentación', 'Transporte', 'Entretenimiento', 'Compras', 'Salud', 'Servicios', 'Otros'
];

const COMMERCES = {
    'Alimentación': ['Crepes & Waffles', 'El Corral', 'Exito', 'Carulla', 'Oxxo', 'D1', 'Ara', 'Restaurante', 'Puesto de Empanadas', 'Fruteria', 'Starbucks', 'Juan Valdez', 'McDonalds', 'KFC', 'Frisby', 'Kokoriko'],
    'Transporte': ['Uber', 'Didi', 'Cabify', 'Taxi', 'Metro', 'Transmilenio', 'Bus', 'Gasolinera', 'Parqueadero', 'Peaje', 'Taller Mecanico'],
    'Entretenimiento': ['Cine Colombia', 'Netflix', 'Spotify', 'Bar', 'Discoteca', 'Concierto', 'Estadio', 'Teatro', 'Parque de Diversiones', 'Bolera'],
    'Compras': ['Falabella', 'Zara', 'H&M', 'Amazon', 'Mercado Libre', 'Centro Comercial', 'Tienda de Ropa', 'Papeleria', 'Ferreteria', 'Tienda de Barrio'],
    'Salud': ['Drogueria', 'Farmatodo', 'Cruz Verde', 'Consulta Medica', 'Odontologo', 'Gimnasio', 'SmartFit', 'Bodytech', 'EPS', 'Laboratorio'],
    'Servicios': ['Claro', 'Movistar', 'Tigo', 'ETB', 'Enel', 'Vanti', 'Acueducto', 'Administracion', 'Internet', 'Recarga Celular'],
    'Otros': ['Varios', 'Cosas', 'Regalo', 'Prestamo', 'Donacion', 'Mesada', 'Otros']
};

const TEMPLATES = [
    "Gaste {amount} en {commerce}",
    "Pague {amount} en {commerce}",
    "Compre en {commerce} por {amount}",
    "{commerce} {amount}",
    "{amount} en {commerce}",
    "Fui a {commerce} y gaste {amount}",
    "Pague la cuenta de {commerce} por {amount}",
    "Transferi {amount} para {commerce}"
];

const MONETARY_TERMS = ['pesos', 'COP', 'lucas', 'barras', 'mil', 'k', ''];

// Helpers
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatAmount(amount) {
    // 50% chance of using 'k' for thousands
    if (Math.random() > 0.5 && amount >= 1000 && amount % 1000 === 0) {
        return (amount / 1000) + 'k';
    }
    // 20% chance of formatting with dots
    if (Math.random() > 0.8) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    return amount.toString();
}

function generateExample(id) {
    const category = getRandomElement(CATEGORIES);
    const commerce = getRandomElement(COMMERCES[category]);
    const amountVal = getRandomInt(5, 500) * 1000; // 5000 to 500,000 implicit
    const amountStr = formatAmount(amountVal);
    const currencyTerm = getRandomElement(MONETARY_TERMS);

    let template = getRandomElement(TEMPLATES);

    // Construct text
    let text = template
        .replace('{amount}', `${amountStr} ${currencyTerm}`.trim())
        .replace('{commerce}', commerce);

    // Add some noise/variations
    text = text.toLowerCase();
    if (Math.random() > 0.9) text = text.replace('gaste', 'gasté');
    if (Math.random() > 0.9) text = text.replace('pague', 'pagué');
    if (Math.random() > 0.9) text = text.replace('compre', 'compré');

    return {
        id: `syn_${id.toString().padStart(4, '0')}`,
        texto: text,
        etiqueta: {
            categoria_principal: category,
            monto: amountVal,
            moneda: 'COP',
            comercio: commerce.toLowerCase(),
            confianza_etiquetado: 1.0,
            etiquetado_por: "sintetico",
            fecha_mensaje: new Date().toISOString().split('T')[0]
        },
        metadata: {
            usuario_id: "synthetic_gen",
            region: "Colombia",
            fuente: "script_v1"
        }
    };
}

// Main
function generateDataset() {
    const examples = [];
    for (let i = 0; i < TARGET_COUNT; i++) {
        examples.push(generateExample(i + 1));
    }

    const dataset = {
        version: "1.0",
        fecha_creacion: new Date().toISOString(),
        idioma_principal: "es-CO",
        total_ejemplos: examples.length,
        ejemplos: examples
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
    console.log(`✅ Generated ${examples.length} examples in ${OUTPUT_FILE}`);
}

generateDataset();
