import { Stack } from 'expo-router';
import React from 'react';

const AccountingLayout = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="accounts" />
    <Stack.Screen name="journal" />
    <Stack.Screen name="ledger" />
    <Stack.Screen name="balance" />
    <Stack.Screen name="income" />
  </Stack>
);

export default AccountingLayout;
