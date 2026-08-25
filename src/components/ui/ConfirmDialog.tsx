"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Confirmacion para acciones destructivas.
 * Uso: const [confirm, dialog] = useConfirm(); ... await confirm({...})
 */
export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  React.ReactNode,
] {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setState({ options, resolve }));

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = state ? (
    <Modal
      open
      onClose={() => close(false)}
      title={state.options.title}
      description={state.options.description}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => close(true)}>
            {state.options.confirmLabel ?? "Eliminar"}
          </Button>
        </>
      }
    >
      <p className="text-sm ink-secondary">
        {state.options.body ?? "Esta acción no se puede deshacer."}
      </p>
    </Modal>
  ) : null;

  return [confirm, dialog];
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  body?: string;
  confirmLabel?: string;
}
