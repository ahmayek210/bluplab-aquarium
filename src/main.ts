import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/nunito/wght.css';
import './style.css';
import { App } from './app';
import { registerOffline } from './service-worker';

new App(document.querySelector('#app')!);
registerOffline();
