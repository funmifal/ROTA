import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../theme/tokens';
import { AppTab, useAppStore } from '../state/useAppStore';

interface NavItem {
  id: AppTab;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    activeIcon: 'grid',
    inactiveIcon: 'grid-outline',
  },
  {
    id: 'shifts',
    label: 'Shifts',
    activeIcon: 'calendar',
    inactiveIcon: 'calendar-outline',
  },
  {
    id: 'team',
    label: 'Team',
    activeIcon: 'people',
    inactiveIcon: 'people-outline',
  },
  {
    id: 'billing',
    label: 'Billing',
    activeIcon: 'card',
    inactiveIcon: 'card-outline',
    badge: 'UPGRADE',
  },
  {
    id: 'settings',
    label: 'Settings',
    activeIcon: 'settings',
    inactiveIcon: 'settings-outline',
  },
];

interface BottomNavBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.tabButton}
              onPress={() => onTabChange(item.id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${item.label} Tab`}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Ionicons
                  name={isActive ? item.activeIcon : item.inactiveIcon}
                  size={20}
                  color={isActive ? Colors.primary : Colors.onSurfaceVariant}
                />
                {item.badge && !isActive ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralContainer,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    ...Effects.mediumShadow,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 3,
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryContainer,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  labelInactive: {
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.tertiary,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.onTertiary,
  },
});
