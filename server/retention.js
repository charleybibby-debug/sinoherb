export async function cleanupExpiredData(repository) {
  if (repository.cleanupExpiredData) return repository.cleanupExpiredData();
  return { sessions: 0, carts: 0 };
}
