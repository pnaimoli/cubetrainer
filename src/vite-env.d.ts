/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module JSX {
  interface IntrinsicElements {
    'twisty-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & TwistyPlayerConfig;
  }
}
