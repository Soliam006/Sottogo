import type { UserProfile } from "@/core/models";
import { asRow, type Db, RepositoryError, unwrap } from "./base";
import { toUserProfile } from "@/services/mappers";

export const profilesRepo = {
  /**
   * Cambia el nombre y el usuario propios.
   *
   * Va por RPC y no por un `update` directo aunque la politica de `profiles` lo
   * permita: al cambiar de usuario, el codigo de siempre puede estar cogido bajo
   * el usuario nuevo, y decidir si se conserva o se cambia exige mirar perfiles
   * ajenos que el cliente no tiene derecho a leer.
   */
  async updateMine(db: Db, name: string, username: string): Promise<UserProfile> {
    const result = await db.rpc("update_my_profile", {
      p_name: name,
      p_username: username,
    });
    if (result.error) throw new RepositoryError(result.error.message, result.error);
    return toUserProfile(asRow(unwrap(result, "Guardar el perfil")));
  },
};
