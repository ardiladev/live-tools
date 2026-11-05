// extensible.html → widget "Subathon extensible": el mismo subathon (src/widgets/subathon) con la
// barra de la meta (clave mt). Estilos: subathon.css + extensible.css (encima).
import { montarWidget } from '../../componentes/montarWidget';
import { Subathon } from '../subathon/Subathon';
import './extensible.css';

montarWidget(<Subathon extensible />);
