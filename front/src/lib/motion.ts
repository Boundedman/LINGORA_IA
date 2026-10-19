import type {Variants} from 'motion/react';

export const entranceVariants:Variants={
 hidden:{opacity:0,y:12},
 visible:{opacity:1,y:0,transition:{duration:.32,ease:[.22,1,.36,1]}},
 exit:{opacity:0,y:-6,transition:{duration:.18,ease:'easeOut'}},
};

export const staggerVariants:Variants={
 hidden:{},
 visible:{transition:{staggerChildren:.075,delayChildren:.04}},
};
