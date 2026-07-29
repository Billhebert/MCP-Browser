type Factory<T> = (...deps: any[]) => T;

interface Registration<T = any> {
  factory: Factory<T>;
  deps: string[];
  singleton: boolean;
  instance?: T;
}

export class Container {
  private registry = new Map<string, Registration>();
  private resolving = new Set<string>();

  register<T>(name: string, factory: Factory<T>, deps: string[] = [], singleton = true): void {
    this.registry.set(name, { factory, deps, singleton });
  }

  resolve<T>(name: string): T {
    const reg = this.registry.get(name);
    if (!reg) throw new Error(`Dependency "${name}" not registered`);

    if (reg.singleton && reg.instance !== undefined) return reg.instance as T;

    if (this.resolving.has(name)) throw new Error(`Circular dependency detected: ${name}`);
    this.resolving.add(name);

    try {
      const depInstances = reg.deps.map((dep) => this.resolve<any>(dep));
      const instance = reg.factory(...depInstances) as T;
      if (reg.singleton) reg.instance = instance;
      return instance;
    } finally {
      this.resolving.delete(name);
    }
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  reset(): void {
    for (const [, reg] of this.registry) reg.instance = undefined;
  }
}

let _container: Container | null = null;

export function getContainer(): Container {
  if (!_container) _container = new Container();
  return _container;
}
