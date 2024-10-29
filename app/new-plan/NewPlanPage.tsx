"use client";

import React from "react";
import { NewPlanProvider } from './NewPlanContext';
import CreatePlanWizard from './components/NewPlanWizard';

export default function NewPlanPage() {
  return (
    <NewPlanProvider>
      <CreatePlanWizard />
    </NewPlanProvider>
  );
}
