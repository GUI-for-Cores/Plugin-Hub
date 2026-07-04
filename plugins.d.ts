type Recordable<T = any> = { [x: string]: T }

type MaybePromise<T> = T | Promise<T>

type Vue = typeof import('vue')
type VNode = import('vue').VNode

type UseModalOptions = Partial<{
  open: boolean
  title?: string
  footer?: boolean
  maxHeight?: string
  maxWidth?: string
  minWidth?: string
  minHeight?: string
  width?: string
  height?: string
  cancel?: boolean
  submit?: boolean
  cancelText?: string
  submitText?: string
  maskClosable?: boolean
  onOk?: () => MaybePromise<boolean | void>
  onCancel?: () => MaybePromise<boolean | void>
  beforeClose?: (isOk: boolean) => MaybePromise<boolean | void>
  afterClose?: (isOk: boolean) => void
}>

interface UseModalSlots {
  title?: () => any
  toolbar?: () => any
  action?: () => any
  cancel?: () => any
  submit?: () => any
  default?: () => any
}

// Custom Action
interface CustomActionApi {
  h: Vue['h']
  ref: Vue['ref']
}
type CustomActionProps = Recordable
type CustomActionSlots = Recordable<((api: CustomActionApi) => VNode | string | number | boolean) | VNode | string | number | boolean>
interface CustomAction<P = CustomActionProps, S = CustomActionSlots> {
  id?: string
  component: string
  componentProps?: P | ((api: CustomActionApi) => P)
  componentSlots?: S | ((api: CustomActionApi) => S)
}
type CustomActionFn = ((api: CustomActionApi) => CustomAction) & {
  id?: string
}

type StreamEvent =
  | {
      type: 'response'
      status: number
      headers: Record<string, string | string[]>
    }
  | {
      type: 'message'
      event: string
      data: string
      id?: string
      retry?: number
    }
  | {
      type: 'done'
    }
  | {
      type: 'error'
      error: string
    }

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
type RequestProxyMode = 'system' | 'kernel' | 'custom'
type IOOptions = { Mode?: 'Binary' | 'Text'; Range?: string }
type NetOptions = { Timeout?: number; Mode?: 'Binary' | 'Text' }
type RequestOptions = {
  Proxy?: string
  Insecure?: boolean
  Redirect?: boolean
  Timeout?: number
  CancelId?: string
  FileField?: string
  Sha256?: string
  Stream?: string
  Method?: RequestMethod
}
type RequestHeaders = {
  'Content-Type'?: 'application/json' | 'application/x-www-form-urlencoded' | 'text/plain' | string
} & Record<string, string>
type HttpResponse<T = any> = { status: number; headers: Record<string, string | string[]>; body: T }
type ExecOptions = {
  PidFile?: string
  LogFile?: string
  Convert?: boolean
  Env?: Record<string, any>
  StopOutputKeyword?: string
  WorkingDirectory?: string
  convert?: boolean
  env?: Record<string, any>
  stopOutputKeyword?: string
}
type ServerOptions = {
  Cert?: string
  Key?: string
  StaticPath?: string
  StaticRoute?: string
  StaticHeaders?: Recordable
  UploadPath?: string
  UploadRoute?: string
  UploadHeaders?: Recordable
  MaxUploadSize?: number
}
type ServerRequest = {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body: string
}
type ServerResponse = {
  end: (status: number, headers: Record<string, string>, body: string, options?: { mode?: 'Binary' | 'Text'; Mode?: 'Binary' | 'Text' }) => void
}
type QueryMMDBType = 'ASN' | 'AnonymousIP' | 'City' | 'ConnectionType' | 'Country' | 'Domain' | 'Enterprise'
type ProxyEndpoint = { host: string; port: number; username: string; password: string }
type PluginTriggerEvent =
  | 'onEnabled'
  | 'onDisabled'
  | 'onDispose'
  | 'onInstall'
  | 'onUninstall'
  | 'onRun'
  | 'onTrayUpdate'
  | 'onSubscribe'
  | 'onGenerate'
  | 'onStartup'
  | 'onShutdown'
  | 'onReady'
  | 'onReload'
  | 'onTask'
  | 'onConfigure'
  | 'onCoreStarted'
  | 'onCoreStopped'
  | 'onBeforeCoreStart'
  | 'onBeforeCoreStop'

interface Plugins {
  APP_TITLE: string
  APP_VERSION: string
  APP_VERSION_API: string
  APP_LOCALES_URL: string
  PROJECT_URL: string
  TG_GROUP: string
  TG_CHANNEL: string
  isDev: boolean
  YAML: {
    parse(text: string): any
    stringify(obj: any): string
  }
  SubStoreCache?: {
    data: Record<string, any>
    sync: () => void
    get(key: string): any
    set(key: string, value: any): void
    remove(key: string): void
  }

  alert(title: string, content: string, options?: { type?: 'text' | 'markdown' }): Promise<void>
  prompt(title: string, initialValue?: string, options?: { placeholder?: string; type?: string }): Promise<string>
  confirm(
    title: string,
    content: string,
    options?: {
      type?: 'text' | 'markdown'
      okText?: string
      cancelText?: string
    }
  ): Promise<boolean>
  modal(
    options?: UseModalOptions,
    slots?: UseModalSlots
  ): {
    destroy: () => void
  } & {
    open: () => void
    close: () => void
    setProps: (options: UseModalOptions) => void
    patchProps: (options: Partial<UseModalOptions>) => void
    setSlots: (slots: UseModalSlots) => void
    patchSlots: (slots: UseModalSlots) => void
    setComponent: (component: any) => void
    setContent<C = any>(Comp: C, _props?: InstanceType<C>['$props'], _slots?: InstanceType<C>['$slots'], replace = true)
  }
  picker: {
    multi(title: string, options: Array<{ label: string; value: any }>, initialValue?: any[]): Promise<any[]>
    single(
      title: string,
      options: Array<{
        label: string
        value: any
        description?: string
        background?: string
        onSelect?: (item: { value: any }) => void
      }>,
      initialValue?: any[]
    ): Promise<any>
  }
  message: {
    success(msg: string, duration?: number): void
    warn(msg: string, duration?: number): void
    info(
      msg: string,
      duration?: number,
      onClose?: () => void
    ): {
      id: string | number
      update: (msg: string, type?: string) => void
      destroy: () => void
      success: (msg: string) => void
      error: (msg: string) => void
    }
    update(id: string | number, msg: string, type?: string): void
    destroy(id: string | number): void
    error(msg: string): void
  }
  Notify(title: string, body: string): Promise<void>

  OpenDir(path: string): Promise<void>
  OpenURI(uri: string): Promise<void>
  AbsolutePath(relativePath: string): Promise<string>
  CopyFile(src: string, dest: string): Promise<void>
  MakeDir(path: string): Promise<void>
  ReadDir(path: string): Promise<Array<{ name: string; isDir: boolean; size: number }>>
  FileExists(path: string): Promise<boolean>
  FileSHA256(path: string): Promise<string>
  RemoveFile(path: string): Promise<void>
  MoveFile(src: string, dest: string): Promise<void>
  ReadFile(path: string, options?: IOOptions): Promise<string>
  WriteFile(path: string, content: string, options?: IOOptions): Promise<void>
  UnzipGZFile(gzPath: string, destPath: string): Promise<void>
  UnzipZIPFile(zipPath: string, destPath: string): Promise<void>
  UnzipTarGZFile(targzPath: string, destPath: string): Promise<void>

  ListServer(): Promise<string[]>
  StopServer(id: string): Promise<void>
  StartServer(
    address: string,
    serverId: string,
    onRequest: (req: ServerRequest, res: ServerResponse) => void | Promise<void>,
    options?: ServerOptions
  ): Promise<{ close: () => Promise<void> }>

  ProcessInfo(pid: number): Promise<string>
  ProcessMemory(pid: number): Promise<number>
  KillProcess(pid: number, timeout?: number): Promise<void>
  Exec(cmd: string, args?: string[], options?: ExecOptions): Promise<string>
  ExecBackground(cmd: string, args?: string[], onOut?: (out: string) => void, onExit?: (out: string) => void, options?: ExecOptions): Promise<number>

  GetRequestProxy(mode?: RequestProxyMode, customProxy?: string): Promise<string>
  TcpPing(address: string, options?: NetOptions): Promise<number>
  TcpRequest(address: string, data?: string, options?: NetOptions): Promise<any>
  UdpRequest(address: string, data?: string, options?: NetOptions): Promise<any>
  HttpGet<T = any>(url: string, headers?: RequestHeaders, options?: RequestOptions): Promise<HttpResponse<T>>
  HttpHead<T = any>(url: string, headers?: RequestHeaders, options?: RequestOptions): Promise<HttpResponse<T>>
  HttpPost<T = any>(url: string, headers?: RequestHeaders, data?: any, options?: RequestOptions): Promise<HttpResponse<T>>
  HttpPut<T = any>(url: string, headers?: RequestHeaders, data?: any, options?: RequestOptions): Promise<HttpResponse<T>>
  HttpDelete<T = any>(url: string, headers?: RequestHeaders, options?: RequestOptions): Promise<HttpResponse<T>>
  HttpPatch<T = any>(url: string, headers?: RequestHeaders, data?: any, options?: RequestOptions): Promise<HttpResponse<T>>
  Requests<T = any>(options: {
    method?: RequestMethod | string
    url: string
    headers?: RequestHeaders
    body?: any
    autoTransformBody?: boolean
    onStream?: (event: StreamEvent) => void
    options?: RequestOptions
  }): Promise<HttpResponse<T>>
  Download<T = any>(
    url: string,
    path: string,
    headers?: RequestHeaders,
    progressCallback?: (progress: number, total: number) => void,
    options?: RequestOptions
  ): Promise<HttpResponse<T>>
  Upload<T = any>(
    url: string,
    path: string,
    headers?: RequestHeaders,
    progressCallback?: (progress: number, total: number) => void,
    options?: RequestOptions
  ): Promise<HttpResponse<T>>
  HttpCancel(id: string): Promise<void>

  GetInterfaces(): Promise<string[]>
  CheckPermissions(): Promise<boolean>
  SwitchPermissions(enable: boolean): Promise<void>
  GrantTUNPermission(path: string): Promise<void>
  RunWithOsaScript(cmd: string, args?: string[], options?: ExecOptions & { admin?: boolean; wait?: boolean }): Promise<string>
  RunWithPowerShell(cmd: string, args?: string[], options?: ExecOptions & { admin?: boolean; hidden?: boolean; wait?: boolean }): Promise<string>
  RestartApp(): Promise<void>
  ExitApp(): Promise<void>
  ShowMainWindow(): Promise<void>
  BrowserOpenURL(url: string): void
  WindowReloadApp(): Promise<void>
  WindowHide(): Promise<void>
  WindowShow(): Promise<void>
  WindowSetAlwaysOnTop(v: boolean): Promise<void>
  EventsOn(eventName: string, callback: (...data: any[]) => void): () => void
  EventsOnce(eventName: string, callback: (...data: any[]) => void): () => void
  EventsOff(eventName: string, ...additionalEventNames: string[]): void
  EventsEmit(eventName: string, ...data: any[]): void
  EventsOffAll(): void

  UpdateTray(options: { tooltip?: string; icon?: string; title?: string; menus?: any[] }): Promise<void>
  UpdateTrayMenus(menus: any[]): Promise<void>
  UpdateTrayAndMenus(tray: Recordable, menus: any[]): Promise<void>
  GetEnv(): Promise<Recordable>
  GetEnv(key: string): Promise<string>
  IsStartup(): Promise<boolean>
  GetSystemProxy(): Promise<string>
  SetSystemProxy(enable: boolean, server: string, proxyType?: 'mixed' | 'http' | 'socks', bypass?: string, services?: string[]): Promise<string>
  SetSystemDNS(servers: string, services?: string[]): Promise<string>
  GetSystemProxyBypass(): Promise<string>
  ClipboardSetText(text: string): Promise<void>
  ClipboardGetText(): Promise<string>

  OpenMMDB(path: string, id: string): Promise<{ close: () => Promise<void>; query: (ip: string, type?: QueryMMDBType) => Promise<any> }>
  CloseMMDB(path: string, id: string): Promise<void>
  QueryMMDB(path: string, ip: string, type?: QueryMMDBType): Promise<any>

  useAppStore(): {
    isAppExiting: boolean
    isAppReloading: boolean
    menuShow: boolean
    menuPosition: { x: number; y: number }
    menuList: any[]
    tipsShow: boolean
    tipsMessage: string
    tipsPosition: { x: number; y: number }
    modalStack: Array<() => void>
    modalZIndexCounter: number
    showAbout: boolean
    checkForUpdatesLoading: boolean
    restartable: boolean
    downloading: boolean
    remoteVersion: string
    updatable: boolean
    customActions: Recordable
    localesLoading: boolean
    locales: Array<{ label: string; value: string }>
    checkForUpdates(showTips?: boolean): Promise<void>
    downloadApp(): Promise<void>
    loadLocales(delay?: boolean, reload?: boolean): Promise<void>
    addCustomActions: (
      target: 'core_state' | 'title_bar' | 'profiles_header' | 'subscriptions_header',
      actions: CustomAction | CustomAction[] | CustomActionFn | CustomActionFn[]
    ) => () => void
    removeCustomActions: (target: 'core_state' | 'title_bar' | 'profiles_header' | 'subscriptions_header', id: string | string[]) => void
  }
  useKernelApiStore(): {
    startCore: (profile?: Recordable) => Promise<void>
    stopCore: () => Promise<void>
    restartCore: (cleanupTask?: () => Promise<any>, keepRuntimeProfile?: boolean) => Promise<void>
    pid: number
    running: boolean
    starting: boolean
    stopping: boolean
    restarting: boolean
    needRestart: boolean
    config: Recordable
    proxies: Recordable[]
    getProxyEndpoint(): ProxyEndpoint | undefined
    onLogs: (handler: (data: { type: string; payload: string }) => void) => () => void
    onMemory: (handler: (data: { inuse: number; oslimit: number }) => void) => () => void
    onTraffic: (handler: (data: { down: number; up: number }) => void) => () => void
    onConnections: (handler: (data: Recordable) => void) => () => void
  }
  usePluginsStore(): {
    plugins: Recordable[]
    pluginHub: Recordable[]
    pluginHubLoading: boolean
    addPlugin(plugin: Recordable): Promise<void>
    editPlugin(id: string, plugin: Recordable): Promise<void>
    updatePluginState(id: string, plugin: Recordable): Promise<void>
    deletePlugin(id: string): Promise<void>
    updatePlugin(id: string): Promise<void>
    updatePlugins(): Promise<any[]>
    getPluginById(id: string): Recordable | undefined
    reloadPlugin(plugin: Recordable, code?: string, reloadTrigger?: boolean): Promise<void>
    onTrayUpdateTrigger(tray: Recordable, menus: any[]): Promise<{ tray: Recordable; menus: any[] }>
    onSubscribeTrigger(proxies: Recordable[], subscription: Recordable): Promise<Recordable[]>
    onGenerateTrigger(config: Recordable, profile: Recordable): Promise<Recordable>
    onStartupTrigger(): Promise<void>
    onShutdownTrigger(): Promise<void>
    onReadyTrigger(): Promise<void>
    onReloadTrigger(): Promise<void>
    onCoreStartedTrigger(): Promise<void>
    onCoreStoppedTrigger(): Promise<void>
    onBeforeCoreStopTrigger(): Promise<void>
    onBeforeCoreStartTrigger(params: Recordable, profile: Recordable): Promise<Recordable>
    manualTrigger(id: string, event: PluginTriggerEvent | string, ...args: any[]): Promise<any>
    updatePluginHub(): Promise<void>
    findPluginInHubById(id: string): Recordable | undefined
  }
  useRulesetsStore(): {
    rulesets: Recordable[]
    rulesetHub: Recordable
    rulesetHubLoading: boolean
    addRuleset(ruleset: Recordable): Promise<void>
    editRuleset(id: string, ruleset: Recordable): Promise<void>
    deleteRuleset(id: string): Promise<void>
    updateRuleset(id: string): Promise<void>
    updateRulesets(): Promise<any[]>
    getRulesetById(id: string): Recordable | undefined
    getRulesetByName(name: string): Recordable | undefined
    updateRulesetHub(): Promise<void>
  }
  useSubscribesStore(): {
    subscribes: Recordable[]
    addSubscribe(subscription: Recordable): Promise<void>
    editSubscribe(id: string, subscription: Recordable): Promise<void>
    deleteSubscribe(id: string): Promise<void>
    updateSubscribe(id: string, options?: Recordable): Promise<void>
    updateSubscribes(): Promise<any[]>
    getSubscribeById(id: string): Recordable | undefined
    importSubscribe(name: string, url: string): Promise<void>
    getSubscribeTemplate(name?: string, options?: { url?: string }): Recordable
  }
  useEnvStore(): {
    env: {
      appName: string
      appVersion: string
      basePath: string
      appPath: string
      os: string
      arch: string
      isPrivileged: boolean
    }
    systemProxy: boolean
    systemDNSSet: boolean
    setupEnv(): Promise<void>
    setSystemProxy(): Promise<void>
    clearSystemProxy(): Promise<void>
    switchSystemProxy: (enable: boolean) => Promise<void>
    setSystemDNS(proxy: boolean): Promise<void>
  }
  useAppSettingsStore(): {
    app: Recordable
    themeMode: 'light' | 'dark'
  }
  useProfilesStore(): {
    profiles: Recordable[]
    currentProfile: Recordable | undefined
    addProfile(profile: Recordable): Promise<void>
    editProfile(id: string, profile: Recordable): Promise<void>
    deleteProfile(id: string): Promise<void>
    getProfileById: (id: string) => Recordable | undefined
    getProfileTemplate(name?: string): Recordable
  }
  useScheduledTasksStore(): {
    scheduledtasks: Recordable[]
    addScheduledTask(task: Recordable): Promise<void>
    editScheduledTask(id: string, task: Recordable): Promise<void>
    deleteScheduledTask(id: string): Promise<void>
    getScheduledTaskById(id: string): Recordable | undefined
    runScheduledTask(id: string): Promise<any>
  }
  useLogsStore(): {
    kernelLogs: string[]
    scheduledtasksLogs: Array<{ name: string; startTime: number; endTime: number; result: any }>
    isTasksLogEmpty: boolean
  }

  getAppDts(): string
  IsAutoStartEnabled(): Promise<boolean>
  EnableAutoStart(delay?: number): Promise<void>
  DisableAutoStart(): Promise<void>
  generateSecureKey(bits?: number): string
  setIntervalImmediately(fn: () => void, delay: number): number
  formatRelativeTime(dateString: string | number): string
  base64Decode(encoded: string): string
  base64Encode(text: string): string
  base64UrlEncode(text: string): string
  normalizeBase64(text: string): string
  deepClone<T>(obj: T): T
  deepAssign<T extends object>(...args: T[]): T
  omit<T extends object, K extends keyof T>(obj: T, props: K[]): Omit<T, K>
  omitArray<T, K extends keyof T>(arr: T[], fields: K[]): Omit<T, K>[]
  getValue<T = unknown>(obj: unknown, expr: string): T | undefined
  asyncPool: <T, K>(
    poolLimit: number,
    array: T[],
    iteratorFn: (item: T, array: T[]) => Promise<K>
  ) => Promise<Array<{ ok: true; value: K } | { ok: false; error: Error }>>
  createAsyncPool<T, K>(
    poolLimit: number,
    array: T[],
    iteratorFn: (item: T, array: T[]) => Promise<K>
  ): {
    run: () => Promise<Array<{ ok: true; value: K } | { ok: false; error: Error }>>
    controller: {
      pause(): void
      resume(): void
      cancel(): void
    }
  }
  sampleID(): string
  isValidBase64(text: string): boolean
  isValidIPv4(ip: string): boolean
  isValidIPv6(ip: string): boolean
  isValidIPCIDR(text: string): boolean
  isValidSubYAML(text: string): boolean
  isValidSubJson(text: string): boolean
  isValidPaylodYAML(text: string): boolean
  isValidRulesJson(text: string): boolean
  isValidJson(text: string): boolean
  isNumber(value: any): value is number
  isValidCron(pattern: string): boolean
  generateConfig(profile: any, options?: any): Promise<Record<string, any>>
  formatBytes(bytes: number): string
  formatDate(date: string | number, format: string): string
  formatProxyHost(host: string): string
  handleUseProxy(group: any, proxy: Recordable): Promise<void>
  handleChangeMode(mode: 'direct' | 'global' | 'rule'): Promise<void>
  addToRuleSet(id: 'direct' | 'reject' | 'proxy', payloads: string[]): Promise<void>
  debounce(fn: (...args: any[]) => void, delay: number): (...args: any[]) => void
  throttle<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void
  getKernelFileName(isAlpha?: boolean): string
  getKernelAssetFileName(version: string, cpuLevel?: 'v1' | 'v2' | 'v3'): string
  getKernelRuntimeEnv(isAlpha?: boolean): Record<string, string>
  getKernelRuntimeArgs(isAlpha?: boolean): string[]
  getUserAgent(): string
  createTextMatcher(include: string, exclude: string, flags?: string): (text: string) => boolean
  buildSmartRegExp(pattern: string, flags?: string): RegExp | undefined
  reloadApp(): Promise<void>
  getGitHubApiAuthorization?(): string
  sleep(ms: number): Promise<void>
  ignoredError<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined>
  exitApp(): Promise<void>
}

declare namespace globalThis {
  var Plugins: Plugins
  var Vue: Vue
  var AsyncFunction: FunctionConstructor
  var WailsInvoke: any
  var wails: any
}

type PluginMetadata = {
  [k: string]: any
  id: string
  name: string
  version: string
  description: string
  tags: string[]
  type: 'Http' | 'File'
  url: string
  path: string
  triggers: string[]
  hasUI: boolean
  menus: Recordable<string>
  context: {
    profiles: Recordable<string>
    subscriptions: Recordable<string>
    rulesets: Recordable<string>
    plugins: Recordable<string>
    scheduledtasks: Recordable<string>
  }
  status: 0 | 1 | 2
  configuration: {
    id: string
    title: string
    description: string
    key: string
    component: string
    value: any
    options: string[]
  }[]
}

type PluginStatus = number | void

type PluginExposed = {
  onRun?: () => MaybePromise<PluginStatus>
  onEnabled?: () => MaybePromise<PluginStatus>
  onDisabled?: () => MaybePromise<PluginStatus>
  onDispose?: () => MaybePromise<PluginStatus>
  onInstall?: () => MaybePromise<PluginStatus>
  onUninstall?: () => MaybePromise<PluginStatus>
  onTrayUpdate?: (tray, menus) => MaybePromise<{ tray; menus }>
  onSubscribe?: (proxies, subscription) => MaybePromise<proxies>
  onGenerate?: (config, profile) => MaybePromise<config>
  onStartup?: () => MaybePromise<PluginStatus>
  onShutdown?: () => MaybePromise<PluginStatus>
  onCoreStarted?: () => MaybePromise<PluginStatus>
  onCoreStopped?: () => MaybePromise<PluginStatus>
  onBeforeCoreStart?: (config, profile) => MaybePromise<Recordable>
  onBeforeCoreStop?: () => MaybePromise<PluginStatus>
  onReady?: () => MaybePromise<PluginStatus>
  onReload?: () => MaybePromise<PluginStatus>
  onTask?: () => MaybePromise<PluginStatus>
  onConfigure?: (config, old) => MaybePromise<PluginStatus>
}

type EsmPlugin = PluginExposed | ((Plugin: PluginMetadata) => MaybePromise<PluginExposed>)
