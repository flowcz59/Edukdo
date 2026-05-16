import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconName;
  iconFocused: IoniconName;
}

const TABS: TabConfig[] = [
  {
    name: 'home',
    title: 'Accueil',
    icon: 'home-outline',
    iconFocused: 'home',
  },
  {
    name: 'submit',
    title: 'Soumettre',
    icon: 'camera-outline',
    iconFocused: 'camera',
  },
  {
    name: 'shop',
    title: 'Boutique',
    icon: 'gift-outline',
    iconFocused: 'gift',
  },
  {
    name: 'profile',
    title: 'Profil',
    icon: 'person-outline',
    iconFocused: 'person',
  },
];

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.cardBg,
          borderTopColor: Colors.cardBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
