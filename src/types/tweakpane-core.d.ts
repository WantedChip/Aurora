/**
 * Ambient Type Declarations for @tweakpane/core
 * Resolves inlined monorepo types for Tweakpane 4.x
 */

declare module '@tweakpane/core' {
  export interface Semver {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
  }

  export interface TpChangeEvent<T = any> {
    target: any;
    value: T;
    last: boolean;
  }

  export interface BindingParams {
    label?: string;
    index?: number;
    disabled?: boolean;
    hidden?: boolean;
    readonly?: boolean;
    tag?: string;
    view?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: Record<string, any> | Array<{ text: string; value: any }>;
    [key: string]: any;
  }

  export interface FolderParams {
    title: string;
    expanded?: boolean;
    index?: number;
    disabled?: boolean;
    hidden?: boolean;
    tag?: string;
  }

  export interface ButtonParams {
    title: string;
    label?: string;
    index?: number;
    disabled?: boolean;
    hidden?: boolean;
  }

  export interface ButtonApi {
    on(event: 'click', handler: (ev: any) => void): this;
    disabled: boolean;
    hidden: boolean;
    title: string;
    label: string | undefined;
    dispose(): void;
  }

  export interface BindingApi<T = any> {
    label: string | undefined;
    disabled: boolean;
    hidden: boolean;
    refresh(): void;
    dispose(): void;
    on(event: 'change', handler: (ev: TpChangeEvent<T>) => void): this;
  }

  export class FolderApi {
    get title(): string;
    set title(title: string);
    get expanded(): boolean;
    set expanded(expanded: boolean);
    get element(): HTMLElement;
    addBinding<O extends object, Key extends keyof O>(
      object: O,
      key: Key,
      opt_params?: BindingParams
    ): BindingApi<O[Key]>;
    addFolder(params: FolderParams): FolderApi;
    addButton(params: ButtonParams): ButtonApi;
    addBlade(params: any): any;
    remove(api: any): void;
    refresh(): void;
    on(event: 'change', handler: (ev: TpChangeEvent) => void): this;
    dispose(): void;
  }

  export class PluginPool {
    // pool internals
  }

  export type TpPlugin = any;
  export type TpPluginBundle = any;
  export type BaseParams = any;
  export type BaseBladeParams = any;
  export type BindingApiEvents = any;
  export type BooleanInputParams = any;
  export type BooleanMonitorParams = any;
  export type ColorInputParams = any;
  export type InputBindingApi = any;
  export type ListInputBindingApi = any;
  export type ListParamsOptions = any;
  export type MonitorBindingApi = any;
  export type NumberInputParams = any;
  export type NumberMonitorParams = any;
  export type ObjectStyleListOptions = any;
  export type ArrayStyleListOptions = any;
  export type Point2dInputParams = any;
  export type Point3dInputParams = any;
  export type Point4dInputParams = any;
  export type SliderInputBindingApi = any;
  export type StringInputParams = any;
  export type StringMonitorParams = any;
  export type TabApi = any;
  export type TabPageApi = any;
  export type TabPageParams = any;
  export type TabParams = any;
  export type BladeApi = any;
}
