'use client';

import { Button, useDisclosure } from '@heroui/react';
import { CreateCycleModal } from '../../components/admin/create-cycle-modal';
import { CreateMaterialModal } from '../../components/admin/create-material-modal';

export default function TestModalPage() {
  const cycle = useDisclosure();
  const material = useDisclosure();

  return (
    <div className="p-12 space-y-4">
      <h1 className="text-2xl font-bold">Modal Test Page</h1>
      <div className="flex gap-4">
        <Button color="primary" onPress={cycle.onOpen}>Abrir modal ciclo</Button>
        <Button color="primary" variant="bordered" onPress={material.onOpen}>Abrir modal material</Button>
      </div>
      <CreateCycleModal isOpen={cycle.isOpen} onClose={cycle.onClose} />
      <CreateMaterialModal isOpen={material.isOpen} onClose={material.onClose} />
    </div>
  );
}
