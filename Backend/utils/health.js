function getHealth(readyState) {
  return readyState === 1
    ? { statusCode: 200, body: { status: 'ok' } }
    : { statusCode: 503, body: { status: 'unavailable' } };
}

module.exports = getHealth;
