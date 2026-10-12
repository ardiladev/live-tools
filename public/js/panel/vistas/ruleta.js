import * as almacen from '../almacen.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota } from '../ui.js';

const POR_DEFECTO = {
  giftId: '5655',
  regalo: 'una rosa 🌹',
  gpr: 1,
  max: 20,
  ocultar: true,
  sonido: true,
  premios: [
    { texto: 'Baile sencillo', peso: 2 },
    { texto: 'Saludo especial', peso: 3 },
    { texto: 'Canción a elección', peso: 1 },
  ],
};

export default {
  id: 'ruleta',
  titulo: 'Ruleta de regalos',
  descripcion: 'Cada vez que alguien envía el regalo configurado, la ruleta gira en tu transmisión y sortea un premio.',

  render() {
    const cfg = almacen.widget('ruleta', POR_DEFECTO);
    const cambio = () => { almacen.guardar(); widget.actualizar(); };
    const premiosValidos = () => cfg.premios.filter((p) => String(p.texto).trim());

    const widget = tarjetaWidget({
      titulo: 'Ruleta de regalos',
      archivo: 'ruleta.html',
      config: () => ({
        g: String(cfg.giftId).trim() || '5655',
        r: String(cfg.regalo).trim() || 'una rosa 🌹',
        gpr: Math.max(1, Number(cfg.gpr) || 1),
        max: Math.max(1, Number(cfg.max) || 20),
        p: premiosValidos().map((p) => [String(p.texto).trim().slice(0, 40), Math.max(0, Number(p.peso) || 0)]),
      }),
      parametros: () => ({ ocultar: cfg.ocultar ? '1' : '', sonido: cfg.sonido ? '' : '0' }),
      personalizar: [
        casilla('Ocultar la ruleta cuando no hay giros', { marcada: cfg.ocultar, alCambiar: (v) => { cfg.ocultar = v; cambio(); } }),
        casilla('Sonido de clic', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
      ],
      pruebas: [
        { texto: 'Probar 1 regalo', evento: (nombre) => ({ tipo: 'regalo', usuario: nombre, giftId: String(cfg.giftId), nombre: 'Rose', cantidad: 1, diamantes: 1 }) },
        { texto: 'Combo de 3', evento: (nombre) => ({ tipo: 'regalo', usuario: nombre, giftId: String(cfg.giftId), nombre: 'Rose', cantidad: 3, diamantes: 1 }) },
      ],
      validar: () => {
        const p = premiosValidos();
        if (p.length < 2) return 'La ruleta necesita al menos 2 premios.';
        if (!p.some((x) => Number(x.peso) > 0)) return 'Algún premio tiene que tener peso mayor a 0.';
        return '';
      },
    });

    // ---------- Premios ----------
    const lista = el('div');
    let probabilidades = [];
    // Al cambiar un peso solo se reescriben los porcentajes: redibujar la lista quitaría el foco del campo.
    function pintarProbabilidades() {
      const total = cfg.premios.reduce((s, p) => s + Math.max(0, Number(p.peso) || 0), 0) || 1;
      probabilidades.forEach((prob, i) => {
        prob.textContent = `${Math.round((Math.max(0, Number(cfg.premios[i].peso) || 0) / total) * 100)}% de probabilidad`;
      });
    }
    function pintarPremios() {
      probabilidades = [];
      lista.replaceChildren(...cfg.premios.flatMap((p, i) => {
        const prob = el('div', { class: 'probabilidad' });
        probabilidades.push(prob);
        return [
          el('div', { class: 'premio' },
            el('input', { value: p.texto, maxLength: 40, 'aria-label': `Premio ${i + 1}`, oninput: (e) => { p.texto = e.target.value; cambio(); } }),
            el('input', { type: 'number', min: 0, step: 1, value: p.peso, 'aria-label': `Peso del premio ${i + 1}`,
              oninput: (e) => { p.peso = Number(e.target.value); cambio(); pintarProbabilidades(); } }),
            el('button', { title: 'Quitar', 'aria-label': `Quitar premio ${i + 1}`, onclick: () => { cfg.premios.splice(i, 1); cambio(); pintarPremios(); } }, '✕')),
          prob,
        ];
      }));
      pintarProbabilidades();
    }
    pintarPremios();

    return [
      widget.elemento,
      tarjeta('Premios', {},
        el('div', { class: 'encabezado-premios' }, el('span', {}, 'Premio:'), el('span', {}, 'Peso:'), el('span')),
        lista,
        el('button', { class: 'enlace', style: 'margin-top:6px', onclick: () => { cfg.premios.push({ texto: 'Nuevo premio', peso: 1 }); cambio(); pintarPremios(); } }, '+ Agregar premio'),
        nota('El peso define qué tan seguido sale cada premio: un peso de 2 sale el doble que uno de 1.')),
      tarjeta('Regalo que activa la ruleta', {},
        el('div', { class: 'campos' },
          campo('ID del regalo:', { valor: cfg.giftId, inputMode: 'numeric', alCambiar: (v) => { cfg.giftId = v.trim(); cambio(); } }),
          campo('Texto en pantalla:', { valor: cfg.regalo, maxLength: 30, alCambiar: (v) => { cfg.regalo = v; cambio(); } }),
          campo('Giros por regalo:', { tipo: 'number', valor: cfg.gpr, min: 1, max: 10, alCambiar: (v) => { cfg.gpr = v; cambio(); } }),
          campo('Máx. por combo:', { tipo: 'number', valor: cfg.max, min: 1, max: 100, alCambiar: (v) => { cfg.max = v; cambio(); } })),
        nota('La rosa es el 5655. Para usar otro regalo, conéctate en ', el('a', { href: '#/actividad' }, 'Actividad → Eventos en vivo'),
          ', pide que te lo envíen y copia su ID de la tabla “Regalos recibidos”.')),
    ];
  },
};
