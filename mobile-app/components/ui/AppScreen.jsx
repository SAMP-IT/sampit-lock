import React from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const AppScreen = ({
  children,
  style,
  contentContainerStyle,
  scrollable = true,
  refreshing = false,
  onRefresh,
}) => {
  if (scrollable) {
    return (
      <SafeAreaView style={styles.safeRoot} edges={['top', 'bottom']}>
        <ScrollView
          style={[styles.root, style]}
          contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.iconbackground]} // Android
                tintColor={Colors.iconbackground} // iOS
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeRoot} edges={['top', 'bottom']}>
      <View style={[styles.root, styles.contentContainer, style, contentContainerStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: Colors.backgroundwhite,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.backgroundwhite,
  },
  contentContainer: {
    paddingBottom: Theme.spacing.xl + 32,
  },
});

export default AppScreen;
