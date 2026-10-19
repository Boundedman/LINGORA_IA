import {motion} from 'motion/react';
import {ArrowRight,Sparkles} from 'lucide-react';
import {entranceVariants,staggerVariants} from '../lib/motion';

export function Landing({login,signup,explore}:{login:()=>void;signup:()=>void;explore:()=>void}){
 return <main className="landing-shell">
  <motion.section className="landing-card" variants={staggerVariants} initial="hidden" animate="visible">
   <motion.a variants={entranceVariants} className="brand landing-brand" href="#" aria-label="Lingora, inicio"><span className="brand-symbol">l<span>✦</span></span>lingora<span className="brand-dot">.</span></motion.a>
   <motion.div variants={entranceVariants} className="landing-art" aria-hidden="true"><span className="landing-orbit landing-orbit-one"/><span className="landing-orbit landing-orbit-two"/><span className="landing-spark"><Sparkles size={36}/></span><span className="landing-word">Hello<span>.</span></span></motion.div>
   <motion.div variants={entranceVariants} className="landing-copy"><span className="eyebrow">UN POCO CADA DÍA, UN PASO MÁS LEJOS</span><h1>Tu inglés.<br/>Tu mundo.<br/><em>Tu propio ritmo.</em></h1><p>Aprende con intención, practica sin miedo y lleva tus nuevas palabras a la vida real.</p></motion.div>
   <motion.div variants={entranceVariants} className="landing-actions"><button className="primary landing-primary" onClick={signup}>Crear cuenta <ArrowRight size={18}/></button><button className="ghost landing-ghost" onClick={login}>Iniciar sesión</button></motion.div>
   <motion.p variants={entranceVariants} className="landing-footnote">Una cuenta, todos tus dispositivos · Piloto para adultos invitados</motion.p><motion.button variants={entranceVariants} className="landing-explore" onClick={explore}>Explorar lecciones como invitado</motion.button>
  </motion.section>
 </main>;
}
