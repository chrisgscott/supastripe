"use client";

import React from "react";
import { CreatePlanProvider } from './CreatePlanContext';
import CreatePlanWizard from './components/CreatePlanWizard';

export default function CreatePlanPage() {
  return (
    <CreatePlanProvider>
      <CreatePlanWizard />
    </CreatePlanProvider>
  );
}