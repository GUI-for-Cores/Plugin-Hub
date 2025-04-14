interface Plugins {
  APP_TITLE: string
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
    info(
      msg: string,
      duration?: number
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
  Copyfile(src: string, dest: string): Promise<void>
  Makedir(path: string): Promise<void>
  Readdir(path: string): Promise<Array<{ name: string; isDir: boolean; size: number }>>
  FileExists(path: string): Promise<boolean>
  Removefile(path: string): Promise<void>
  Movefile(src: string, dest: string): Promise<void>
  Readfile(path: string, options?: { Mode?: 'Binary' | 'Text' }): Promise<string>
  Writefile(path: string, content: string, options?: { Mode?: 'Binary' | 'Text' }): Promise<void>
  UnzipGZFile(gzPath: string, destPath: string): Promise<void>
  UnzipZIPFile(zipPath: string, destPath: string): Promise<void>

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
        end: (status: number, headers: Record<string, string>, body: string) => void
      }
    ) => void
  ): Promise<{ close: () => Promise<void> }>

  ProcessInfo(pid: number): Promise<string>
  KillProcess(pid: number): Promise<void>
  Exec(cmd: string, args?: string[], options?: { convert?: boolean }): Promise<string>
  ExecBackground(cmd: string, args: string[], onOut: (out: string) => void, onExit: () => void, options?: { env?: Record<string, string> }): Promise<number>

  HttpGet(url: string, headers?: Record<string, string>, options?: { Insecure?: boolean }): Promise<{ status: number; body: any }>
  HttpPost(url: string, headers: Record<string, string>, data: any, options?: { Timeout?: number; Insecure?: boolean }): Promise<{ status: number; body: any }>
  HttpDelete(url: string, headers: Record<string, string>, options?: { Insecure?: boolean }): Promise<{ status: number; body: any }>
  HttpPatch(url: string, headers: Record<string, string>, data: any): Promise<{ status: number; body: any }>
  Requests(options: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
    Insecure?: boolean
  }): Promise<{ status: number; body: any }>
  Download(url: string, path: string, headers?: Record<string, string>, progressCallback?: (progress: number, total: number) => void): Promise<void>

  GetInterfaces(): Promise<string[]>
  CheckPermissions(): Promise<boolean>
  RestartApp(): Promise<void>
  BrowserOpenURL(url: string): void
  WindowReloadApp(): Promise<void>

  ClipboardSetText(text: string): Promise<void>
  ClipboardGetText(): Promise<string>

  OpenMMDB(path: string, id: string): Promise<void>
  CloseMMDB(path: string, id: string): Promise<void>
  QueryMMDB(path: string, ip: string, type?: 'ASN' | 'AnonymousIP' | 'City' | 'ConnectionType' | 'Country' | 'Domain' | 'Enterprise'): Promise<any> // Define return type if known

  useKernelApiStore(): any
  usePluginsStore(): any
  useRulesetsStore(): any
  useSubscribesStore(): any
  useEnvStore(): any
  useAppSettingsStore(): any
  useProfilesStore(): any
  useScheduledTasksStore(): any

  setIntervalImmediately(fn: () => void, delay: number): number
  formatRelativeTime(dateString: string): string
  base64Decode(encoded: string): string
  base64Encode(text: string): string
  deepClone<T>(obj: T): T
  deepAssign<T, U>(target: T, source: U): T & U
  sampleID(): string
  generateConfig(profile: any, stable?: boolean): Promise<any>
  formatBytes(bytes: number): string
  handleUseProxy(group: any, proxy: { name: string }): Promise<void>
  debounce(fn: (...args: any[]) => void, delay: number): (...args: any[]) => void
  getKernelFileName(isAlpha: boolean): Promise<string>
  getUserAgent(): Promise<string>
  getGitHubApiAuthorization?(): string
  sleep(ms: number): Promise<void>
  ignoredError<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): Promise<ReturnType<T> | undefined>
  exitApp(): Promise<void>
}

declare namespace globalThis {
  var Plugins: Plugins
  var Plugin: any
}
