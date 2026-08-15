import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AgendaProvider } from './AgendaContext';

export default function Layout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <AgendaProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { backgroundColor: '#1C1C1E', borderTopWidth: 0 },
            tabBarActiveTintColor: '#FF3B30',
            tabBarInactiveTintColor: '#8E8E93',
          }}
        >
          <Tabs.Screen 
            name="index" 
            options={{ title: 'Explorer' }} 
          />
          <Tabs.Screen 
            name="agenda" 
            options={{ title: 'Agenda' }} 
          />
        </Tabs>
      </AgendaProvider>
    </ThemeProvider>
  );
}
