export type ApiMeta = {
  request_id: string;
};

export type ApiSuccessEnvelope<TData> = {
  ok: true;
  data: TData;
  meta: ApiMeta;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  meta: ApiMeta;
};

export function jsonSuccess<TData>(
  data: TData,
  requestId: string,
  status = 200
) {
  return Response.json(
    {
      ok: true,
      data,
      meta: {
        request_id: requestId
      }
    } satisfies ApiSuccessEnvelope<TData>,
    {
      status
    }
  );
}

export function jsonError(
  code: string,
  message: string,
  requestId: string,
  status: number
) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message
      },
      meta: {
        request_id: requestId
      }
    } satisfies ApiErrorEnvelope,
    {
      status
    }
  );
}
