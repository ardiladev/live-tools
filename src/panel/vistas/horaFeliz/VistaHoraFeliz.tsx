// =============================================================================
// vistas/horaFeliz/VistaHoraFeliz.tsx — Juegos → Potenciadores → Hora feliz y racha
//
// «Empezar hora feliz» guarda la hora de término; panel/modulos.ts la agrega (`hf`) a TODOS
// los juegos que cuentan regalos, y se sube ya a los que están en OBS (solo a los que tienen su
// URL copiada: no se crean identificadores nuevos). Cada juego multiplica lo que suma mientras
// dure; el widget hora-feliz.html lo anuncia con cuenta regresiva y muestra la racha.
// =============================================================================

import { useState } from 'react';
import { useIntervalo } from '../../../hooks/useIntervalo';
import { formatoReloj } from '../../../nucleo/reloj';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Segmentado, Tarjeta, useAviso } from '../../componentes/ui';
import { obtener, tieneIdNube, useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { JUEGOS_HORA_FELIZ, POR_DEFECTO_HORA_FELIZ } from '../../modulos';
import { ID } from './config';

const OPCIONES_X = [[2, '×2'], [3, '×3'], [5, '×5']] as const;

const regalo = (cantidad: number) => (usuario: string): EventoRegalo => ({
  tipo: 'regalo', usuario, giftId: '5655', nombre: 'Rose', cantidad, diamantes: 1, imagen: '',
});

/** Sube ya la configuración de los juegos que están en OBS (los que tienen su URL copiada). */
function subirJuegos(): void {
  const estado = obtener();
  for (const id of JUEGOS_HORA_FELIZ) if (tieneIdNube(estado, id)) void subir(id);
}

export function VistaHoraFeliz() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO_HORA_FELIZ);
  const [aviso, avisar] = useAviso();
  const [ahora, setAhora] = useState(Date.now());
  useIntervalo(() => setAhora(Date.now()), 1000);
  const activa = Number(cfg.hasta) > ahora;
  const minutos = Math.min(120, Math.max(1, Number(cfg.minutos) || 5));

  function empezar(): void {
    cambiarCfg((a) => { a.hasta = Date.now() + minutos * 60000; });
    subirJuegos();
    avisar(`¡Hora feliz! Durante ${minutos} min los regalos valen ×${cfg.multiplicador} en todos los juegos.`);
  }

  function terminar(): void {
    cambiarCfg((a) => { a.hasta = Date.now(); });
    subirJuegos();
    avisar('Hora feliz terminada: los regalos vuelven a valer lo normal.');
  }

  const pruebas: PruebaWidget[] = [
    { texto: 'Regalo', evento: regalo(1) },
    { texto: 'Combo ×10', evento: regalo(10) },
  ];

  return (
    <>
      <Tarjeta titulo="Hora feliz" ancha>
        <div className="reloj-panel">
          <span className="reloj-tiempo">{activa ? formatoReloj(Number(cfg.hasta) - ahora) : '--:--'}</span>
          <span className="reloj-estado">{activa ? `En curso: regalos ×${cfg.multiplicador}` : 'Apagada'}</span>
        </div>
        <div className="separado-arriba">
          <Segmentado etiqueta="Los regalos valen:" opciones={OPCIONES_X} valor={Number(cfg.multiplicador) || 2} alCambiar={(v) => cambiarCfg((a) => { a.multiplicador = v; })} />
        </div>
        <div className="campos separado-arriba">
          <Campo etiqueta="Minutos que dura:" tipo="number" min={1} max={120} step={1} valor={cfg.minutos} alCambiar={(v) => cambiarCfg((a) => { a.minutos = v; })} />
        </div>
        <div className="fila-acciones separado-arriba">
          <button className="principal" onClick={empezar}>{activa ? 'Empezar de nuevo' : 'Empezar hora feliz'}</button>
          <button onClick={terminar} disabled={!activa}>Terminar ahora</button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          Vale en todos los juegos que cuentan regalos: Carrera, Marcador, Batalla, Barra de activación, Duelo VS, Jefe del LIVE,
          Bóveda, Subathon y Repertorio (y en los tap tap de las competencias). Llega a OBS en uno o dos segundos. El Registro de
          bailarinas sigue anotando las monedas reales, sin multiplicar.
        </Nota>
      </Tarjeta>

      <TarjetaWidget
        id={ID}
        titulo="Hora feliz y racha"
        archivo="hora-feliz.html"
        forma="cuadrado"
        sinRecargar={['hf']}
        personalizar={(
          <>
            <Casilla texto="Mostrar la racha de regalos seguidos" marcada={cfg.racha} alCambiar={(v) => cambiarCfg((a) => { a.racha = v; })} />
            <div className="campos">
              <Campo etiqueta="Segundos máximos entre regalos:" tipo="number" min={2} max={60} valor={cfg.segundosRacha} alCambiar={(v) => cambiarCfg((a) => { a.segundosRacha = v; })} />
              <Campo etiqueta="Regalos para que aparezca:" tipo="number" min={1} max={50} valor={cfg.minimoRacha} alCambiar={(v) => cambiarCfg((a) => { a.minimoRacha = v; })} />
            </div>
            <Casilla texto="Sonidos (cada 10 regalos de racha y al batir el récord)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={pruebas}
      />
      <Nota>
        La racha cuenta los regalos que llegan seguidos (un combo de 10 rosas son 10): si pasan más segundos de los configurados sin
        ninguno, termina y se anuncia «¡Racha de N!». La mejor del LIVE queda como récord. Tamaño recomendado de la fuente: 900 × 320.
        Sin Hora feliz ni racha, el widget no se ve.
      </Nota>
    </>
  );
}
