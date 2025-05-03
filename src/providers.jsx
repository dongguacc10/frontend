import { HeroUIProvider, ToastProvider } from '@heroui/react';

export default function Providers({ children }) {
  return (
    <HeroUIProvider>
      <ToastProvider />
      {children}
    </HeroUIProvider>
  );
}
