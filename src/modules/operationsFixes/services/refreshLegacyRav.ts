import { IOperationFixeRepository } from "../operationFixeRepository.interface";

export async function refreshLegacyRav(
  repository: IOperationFixeRepository,
  userId: string
): Promise<void> {
  const [create, id] = await repository.updateOrCreateRaV(userId);
  if (create) await repository.createRaV(userId);
  else await repository.updateRaV(userId, id);
}
