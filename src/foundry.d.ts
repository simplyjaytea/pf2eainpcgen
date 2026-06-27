// Minimal Foundry ambient declarations for standalone build of the module
// At runtime, Foundry globals are provided by the PF2e system + core.

declare const game: any;
declare const ui: any;
declare const canvas: any;
declare const Hooks: any;
declare const $: any;
declare const fu: any;
declare const foundry: any;

declare namespace globalThis {
  var game: any;
  var ui: any;
  var canvas: any;
  var Hooks: any;
  var $: any;
  var fu: any;
  var foundry: any;
}

type PreCreate<T> = T & { _id?: string | null };

declare namespace fa {
  namespace api {
    class ApplicationV2<TConfig = any> {
      static DEFAULT_OPTIONS: any;
      static PARTS: any;
      element: HTMLElement;
      constructor(config?: TConfig);
      render(force?: boolean, options?: any): Promise<this>;
      close(): Promise<void>;
    }
    class HandlebarsApplicationMixin<TBase extends new (...args: any[]) => any> {
      // Mixin returns a class; we just declare it loosely for build
      static new<T extends new (...args: any[]) => any>(Base: T): T;
    }
  }
  type ApplicationRenderContext = Record<string, any>;
  type ApplicationRenderOptions = Record<string, any>;
  namespace api {
    type HandlebarsRenderOptions = Record<string, any>;
  }
}

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };
