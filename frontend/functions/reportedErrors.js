// Request errors the response interceptor has already shown the user. Callers usually pass the
// error, its response or the response's data on to alertUserResponse, so all three are kept.
const reported = new WeakSet()

export const markReported = (error) => {
  [error, error?.response, error?.response?.data].forEach(value => {
    if (value && typeof value === 'object') reported.add(value)
  })
}

export const wasReported = (value) => !!value && typeof value === 'object' && reported.has(value)
