'use client'

import React, { useState } from 'react';
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
    ConnectAccountManagement,
    ConnectComponentsProvider,
} from '@stripe/react-connect-js';

const AccountManagementUI = () => {
    const [stripeConnectInstance] = useState(() => {
        const fetchClientSecret = async () => {
            const response = await fetch('/api/create-account-session', { method: 'POST' });
            if (!response.ok) {
                const { error } = await response.json();
                console.error('An error occurred: ', error);
                return undefined;
            } else {
                const { clientSecret } = await response.json();
                return clientSecret;
            }
        };

        return loadConnectAndInitialize({
            publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
            fetchClientSecret,
            appearance: {
                overlays: 'dialog',
                variables: {
                    colorPrimary: '#625afa',
                },
            },
        });
    });

    if (!stripeConnectInstance) {
        return <div>Loading Stripe Connect...</div>;
    }

    return (
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountManagement />
        </ConnectComponentsProvider>
    );
};

export default AccountManagementUI;
