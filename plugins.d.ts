type Recordable<T = any> = { [x: string]: T }

type MaybePromise<T> = T | Promise<T>

type Vue = typeof import('vue')

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

interface Plugins {
  APP_TITLE: string
  APP_VERSION: string
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

  alert(title: string, content: string, options?: { type?: string; markdown?: boolean }): Promise<void>
  prompt(title: string, initialValue?: string, options?: { placeholder?: string; type?: string }): Promise<string>
  confirm(
    title: string,
    content: string,
    options?: {
      type?: string
      okText?: string
      cancelText?: string
      markdown?: boolean
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

  AbsolutePath(relativePath: string): Promise<string>
  CopyFile(src: string, dest: string): Promise<void>
  MakeDir(path: string): Promise<void>
  ReadDir(path: string): Promise<Array<{ name: string; isDir: boolean; size: number }>>
  FileExists(path: string): Promise<boolean>
  RemoveFile(path: string): Promise<void>
  MoveFile(src: string, dest: string): Promise<void>
  ReadFile(path: string, options?: { Mode?: 'Binary' | 'Text' }): Promise<string>
  WriteFile(path: string, content: string, options?: { Mode?: 'Binary' | 'Text' }): Promise<void>
  UnzipGZFile(gzPath: string, destPath: string): Promise<void>
  UnzipZIPFile(zipPath: string, destPath: string): Promise<void>
  UnzipTarGZFile(targzPath: string, destPath: string): Promise<void>

  ListServer(): Promise<string[]>
  StopServer(id: string): Promise<void>
  StartServer(
    address: string,
    serverId: string,
    onRequest: (
      req: {
        url: string
        method: string
        headers: Record<string, string>
        body: string
      },
      res: {
        end: (status: number, headers: Record<string, string>, body: string, options?: { Mode: 'Binary' | 'Text' }) => void
      }
    ) => void,
    options?: {
      StaticPath?: string
      UploadPath?: string
      UploadRoute?: string
      MaxUploadSize?: number
    }
  ): Promise<{ close: () => Promise<void> }>

  ProcessInfo(pid: number): Promise<string>
  KillProcess(pid: number, timeout?: number): Promise<void>
  Exec(cmd: string, args?: string[], options?: { convert?: boolean }): Promise<string>
  ExecBackground(
    cmd: string,
    args: string[],
    onOut: (out: string) => void,
    onExit: () => void,
    options?: { env?: Record<string, string>; convert?: boolean }
  ): Promise<number>

  Request: any
  HttpGet(
    url: string,
    headers?: Record<string, string>,
    options?: { Insecure?: boolean; Redirect?: boolean }
  ): Promise<{ status: number; headers: Record<string, string>; body: any }>
  HttpPost(
    url: string,
    headers: Record<string, string>,
    data: any,
    options?: { Timeout?: number; Insecure?: boolean; Redirect?: boolean }
  ): Promise<{ status: number; headers: Record<string, string>; body: any }>
  HttpDelete(
    url: string,
    headers: Record<string, string>,
    options?: { Insecure?: boolean; Redirect?: boolean }
  ): Promise<{ status: number; headers: Record<string, string>; body: any }>
  HttpPatch(url: string, headers: Record<string, string>, data: any): Promise<{ status: number; headers: Record<string, string>; body: any }>
  Requests(options: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
    autoTransformBody?: boolean
    options?: {
      Insecure?: boolean
      Redirect?: boolean
    }
  }): Promise<{ status: number; body: any }>
  Download(
    url: string,
    path: string,
    headers?: Record<string, string>,
    progressCallback?: (progress: number, total: number) => void,
    options?: {
      Method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    }
  ): Promise<void>

  GetInterfaces(): Promise<string[]>
  CheckPermissions(): Promise<boolean>
  RestartApp(): Promise<void>
  BrowserOpenURL(url: string): void
  WindowReloadApp(): Promise<void>
  WindowHide(): Promise<void>
  WindowShow(): Promise<void>
  WindowSetAlwaysOnTop(v: boolean): Promise<void>

  ClipboardSetText(text: string): Promise<void>
  ClipboardGetText(): Promise<string>

  ValidateCron(expression): Promise<boolean>

  OpenMMDB(path: string, id: string): Promise<void>
  CloseMMDB(path: string, id: string): Promise<void>
  QueryMMDB(path: string, ip: string, type?: 'ASN' | 'AnonymousIP' | 'City' | 'ConnectionType' | 'Country' | 'Domain' | 'Enterprise'): Promise<any> // Define return type if known

  useAppStore(): {
    showAbout: boolean
    addCustomActions: (
      target: 'core_state' | 'title_bar' | 'profiles_header' | 'subscriptions_header',
      actions: CustomAction | CustomAction[] | CustomActionFn | CustomActionFn[]
    ) => () => void
    removeCustomActions: (target: 'core_state' | 'title_bar' | 'profiles_header' | 'subscriptions_header', id: string | string[]) => void
  }
  useKernelApiStore(): {
    startCore: (profile?: Recordable) => Promise<void>
    stopCore: () => Promise<void>
    restartCore: (cleanupTask?: () => Promise<any>, keepRuntimeProfile = true) => Promise<void>
    pid: number
    running: boolean
    config: Recordable
    proxies: Recordable[]
    onLogs: (data: { type: string; payload: string }) => () => void
    onMemory: (data: { inuse: number; oslimit: number }) => () => void
    onTraffic: (data: { down: number; up: number }) => () => void
    onConnections: (data: Recordable) => () => void
    updateConfig(field: string, value: any): Promise<void>
  }
  usePluginsStore(): {
    plugins: Recordable[]
    pluginHub: Recordable[]
    manualTrigger: (id: string, event: string, ...args: any[]) => Promise<void>
    addPlugin(plugin: Recordable): Promise<void>
    getPluginById(id: string): Recordable
    editPlugin(id: string, plugin: Recordable): Promise<void>
    deletePlugin(id: string): Promise<void>
    updatePlugin(id: string): Promise<void>
  }
  useRulesetsStore(): {
    rulesets: Recordable[]
    updateRuleset(id: string): Promise<void>
    updateRulesets(): Promise<void>
    addRuleset(ruleset: Recordable): Promise<void>
    getRulesetById(id: string): Recordable
    editRuleset(id: string, ruleset: Recordable): Promise<void>
    deleteRuleset(id: string): Promise<void>
  }
  useSubscribesStore(): {
    subscribes: Recordable[]
    updateSubscribe(id: string): Promise<void>
    updateSubscribes(): Promise<void>
    getSubscribeById(id: string): Recordable
    addSubscribe(subscription: Recordable): Promise<void>
    editSubscribe(id: string, subscription: Recordable): Promise<void>
    deleteSubscribe(id: string): Promise<void>
  }
  useEnvStore(): {
    env: {
      appName: string
      appVersion: string
      basePath: string
      os: string
      arch: string
    }
    systemProxy(): Promise<void>
    setSystemProxy(): Promise<void>
    clearSystemProxy(): Promise<void>
    switchSystemProxy: (enable: boolean) => Promise<void>
  }
  useAppSettingsStore(): {
    app: Recordable
  }
  useProfilesStore(): {
    profiles: Recordable[]
    getProfileById: (id: string) => Recordable
    addProfile(profile: Recordable): Promise<void>
    editProfile(id: string, profile: Recordable): Promise<void>
    deleteProfile(id: string): Promise<void>
  }
  useScheduledTasksStore(): {
    scheduledtasks: Recordable[]
    getScheduledTaskById(id: string): Recordable
    addScheduledTask(task: Recordable): Promise<void>
    editScheduledTask(id: string, task: Recordable): Promise<void>
    deleteScheduledTask(id: string): Promise<void>
    runScheduledTask(id: string): Promise<any>
  }

  setIntervalImmediately(fn: () => void, delay: number): number
  formatRelativeTime(dateString: string): string
  base64Decode(encoded: string): string
  base64Encode(text: string): string
  deepClone<T>(obj: T): T
  deepAssign<T, U>(target: T, source: U): T & U
  asyncPool: <T>(poolLimit: number, array: T[], iteratorFn: (item: T, array: T[]) => Promise<any>) => Promise<any[]>
  sampleID(): string
  isValidIPv4(ip: string): boolean
  generateConfig(profile: any, stable?: boolean): Promise<Record<string, any>>
  formatBytes(bytes: number): string
  formatDate(date: string | number, format: string): string
  handleUseProxy(group: any, proxy: Recordable): Promise<void>
  handleChangeMode(mode: 'direct' | 'global' | 'rule'): Promise<void>
  debounce(fn: (...args: any[]) => void, delay: number): (...args: any[]) => void
  getKernelFileName(isAlpha: boolean): Promise<string>
  getUserAgent(): Promise<string>
  GetSystemProxy(): Promise<string>
  getGitHubApiAuthorization?(): string
  sleep(ms: number): Promise<void>
  ignoredError<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): Promise<ReturnType<T> | undefined>
  exitApp(): Promise<void>
}

declare namespace globalThis {
  var Plugins: Plugins
  var Plugin: any
  var Vue: Vue
  var AsyncFunction: FunctionConstructor
}
