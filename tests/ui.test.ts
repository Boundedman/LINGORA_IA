import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.scrollTo=()=>{};
const {render,screen,fireEvent,cleanup,waitFor}=await import('@testing-library/react');
const {default:App}=await import('../src/App');
afterEach(()=>cleanup());
test('unconfigured application opens a real catalog and completes a practice without fake persistence',async()=>{
 render(React.createElement(App));
 assert.ok(screen.getByText('Tu propio ritmo.'));
 fireEvent.click(screen.getByRole('button',{name:'Comenzar mi práctica'}));
 assert.ok(screen.getByRole('heading',{name:'Conoce a alguien'}));
 for(const word of ['nombre','trabajar','vivir','amigo o amiga']){
  fireEvent.click(screen.getByRole('radio',{name:word}));
  fireEvent.click(screen.getByRole('button',{name:'Comprobar y continuar'}));
  await waitFor(()=>assert.ok(screen.getByText('¡Bien! Identificaste la respuesta.')));
  fireEvent.click(screen.getByRole('button',{name:'Continuar',exact:true}));
 }
 assert.ok(screen.getByText('Una lección más en tu camino'));
 assert.ok(screen.getByText(/Inicia sesión para guardar tu progreso entre dispositivos/));
});
test('catalog filters B2 writing and renders an actual open exercise',()=>{
 render(React.createElement(App));
 fireEvent.click(screen.getByRole('button',{name:'Lecciones',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'B2',exact:true}));
 fireEvent.change(screen.getByLabelText('Área'),{target:{value:'writing'}});
 fireEvent.click(screen.getByRole('button',{name:/Dale forma a tus ideas/}));
 assert.ok(screen.getByRole('heading',{name:/Escribe 100–130 palabras/}));
});
test('diagnostic explains sign-in instead of inventing a user profile',()=>{
 render(React.createElement(App));
 fireEvent.click(screen.getByRole('button',{name:'Conocer mi nivel'}));
 assert.ok(screen.getByRole('button',{name:'Entrar para comenzar'}));
 fireEvent.click(screen.getByRole('button',{name:'Entrar para comenzar'}));
 assert.ok(screen.getByRole('dialog'));
});
