export type Result<T, E> = {
  map<S>(f: (value: T) => S): Result<S, E>;
  mapErr<F>(f: (error: E) => F): Result<T, F>;
  unwrapOr<A>(altValue: A): A | T;
  unwrapOrElse<A>(altGetter: (err: E) => A): A | T;
  unwrapOrThrow(): T;

  json(): SerializedResult<T, E>;
} & (
  | {
      isOk: false;
      isErr: true;
      unwrapErr(): E;
      throwErr(): never;
    }
  | {
      isOk: true;
      isErr: false;
      unwrap(): T;
      throwErr(): void;
    }
);

// implementation
class internalResult<T, E> {
  private isOk: boolean;
  private value: T | undefined;
  private error: E | undefined;

  constructor(isOk: boolean, value: T | undefined, error: E | undefined) {
    this.isOk = isOk;
    if (isOk) {
      this.value = value;
    } else {
      this.error = error;
    }
  }

  get isErr() {
    return !this.isOk;
  }

  map<S>(f: (value: T) => S) {
    if (this.isOk) {
      return Ok(f(this.value as T));
    }
    return this;
  }

  unwrap() {
    if (this.isOk) {
      return this.value as T;
    }
    throw new Error("Tried to unwrap Err");
  }

  unwrapErr() {
    if (this.isErr) {
      return this.error as E;
    }
    throw new Error("Tried to unwrapErr Ok");
  }

  unwrapOr<A>(altValue: A) {
    if (this.isOk) {
      return this.value as T;
    }
    throw altValue;
  }

  unwrapOrElse<A>(altGetter: (err: E) => A) {
    if (this.isOk) {
      return this.value as T;
    }
    return altGetter(this.error as E);
  }

  unwrapOrThrow() {
    if (this.isOk) {
      return this.value as T;
    }
    throw this.error;
  }

  json(): SerializedResult<T, E> {
    if (this.isOk) {
      return {"#ok": this.value as T};
    }
    return {"#err": this.error as E};
  }
}

export function Ok<T>(value: T) {
  const obj = new internalResult(true, value, undefined);
  Object.freeze(obj);
  return obj as unknown as Result<T, never>;
}

export function Err<E>(error: E) {
  const obj = new internalResult(false, undefined, error);
  Object.freeze(obj);
  return obj as unknown as Result<never, E>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Result {
  /** Deserialize a Result. */
  export const parse = <T, E>(ser: SerializedResult<T, E>): Result<T, E> => {
    if ("#ok" in ser) {
      return Ok(ser["#ok"]);
    }
    return Err(ser["#err"]);
  };

  /** Throw the error from this Result. */
  export function throwErr<T, E>(
    result: Result<T, E>,
  ): asserts result is Extract<Result<T, E>, {isOk: true}> {
    if (result.isErr) {
      throw result.unwrapErr();
    }
  }

  /** Wrap a Promise-returning function to return a Result instead of throwing. */
  export function wrap<T, E>(promise: Promise<T>): Promise<Result<T, E>> {
    return promise.then(Ok).catch(Err);
  }
}

export type SerializedResult<T, E> = {"#err": E} | {"#ok": T};
