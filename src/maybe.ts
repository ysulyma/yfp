// interface
interface MaybeMethods<T> {
  map<S>(f: (value: T) => S): Maybe<S>;
  unwrapOr(altValue: T): T;
  unwrapOrElse(f: () => T): T;

  json(): SerializedMaybe<T>;
}

export type Maybe<T> = MaybeMethods<T> &
  (
    | {
        isNone: false;
        isSome: true;
        unwrap(): T;
      }
    | {
        isNone: true;
        isSome: false;
      }
  );

// implementation
class internalMaybe<T> implements MaybeMethods<T> {
  private isSome: boolean;
  private value: T | undefined;

  constructor(isSome: boolean, value?: T) {
    this.isSome = isSome;
    this.value = value;
  }

  get isNone() {
    return !this.isSome;
  }

  map<S>(f: (value: T) => S): Maybe<S> {
    if (this.isSome) {
      return Some(f(this.value as T));
    }
    return None;
  }

  unwrap() {
    if (this.isSome) {
      return this.value as T;
    }
    throw new Error("Tried to unwrap None");
  }

  unwrapOr(altValue: T) {
    if (this.isSome) {
      return this.value as T;
    }
    return altValue;
  }

  unwrapOrElse(f: () => T) {
    if (this.isSome) {
      return this.value as T;
    }
    return f();
  }

  json(): SerializedMaybe<T> {
    if (this.isSome) {
      return {"#some": this.value as T};
    }
    return null;
  }
}

export function Some<T>(value: T): Maybe<T> {
  const obj = new internalMaybe(true, value);
  Object.freeze(obj);
  return obj as unknown as Maybe<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const None = new internalMaybe(false) as unknown as Maybe<any>;
Object.freeze(None);

export type SerializedMaybe<T> = {
  "#some": T;
} | null;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Maybe {
  export function parse<T>(obj: SerializedMaybe<T>): Maybe<T> {
    if (obj === null) {
      return None;
    }
    return Some(obj["#some"]);
  }
}
