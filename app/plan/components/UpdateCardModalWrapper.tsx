'use client';

import React, { useState } from 'react';
import UpdateCardModal from './UpdateCardModal';
import { Button } from "@/components/ui/button";


interface UpdateCardModalWrapperProps {
  stripeCustomerId: string;
  paymentPlanId: string;
}

export default function UpdateCardModalWrapper({ stripeCustomerId, paymentPlanId }: UpdateCardModalWrapperProps) {
  const [isUpdateCardModalOpen, setIsUpdateCardModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsUpdateCardModalOpen(true)} className="w-full mb-2">Update Card</Button>
      <UpdateCardModal 
        isOpen={isUpdateCardModalOpen} 
        onClose={() => setIsUpdateCardModalOpen(false)} 
        stripeCustomerId={stripeCustomerId}
        paymentPlanId={paymentPlanId}
      />
    </>
  );
}
