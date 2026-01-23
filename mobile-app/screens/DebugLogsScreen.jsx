import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AppScreen from '../components/ui/AppScreen';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import logCollector from '../utils/LogCollector';

const DebugLogsScreen = ({ navigation }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const flatListRef = React.useRef(null);

  useEffect(() => {
    // Load initial logs
    updateLogs();

    // Listen for new logs
    const unsubscribe = logCollector.onLogAdded(() => {
      updateLogs();
    });

    return unsubscribe;
  }, [filter]);

  const updateLogs = () => {
    const filteredLogs = filter
      ? logCollector.getLogsFiltered(filter)
      : logCollector.getLogs();
    setLogs(filteredLogs);

    // Auto-scroll to bottom when new log arrives
    if (autoScroll && flatListRef.current && filteredLogs.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            logCollector.clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  const handleCopyAll = async () => {
    const logsText = logCollector.exportLogs();
    await Clipboard.setStringAsync(logsText);
    Alert.alert('Success', 'Logs copied to clipboard');
  };

  const handleShareLogs = async () => {
    try {
      const logsText = logCollector.exportLogs();
      await Share.share({
        message: logsText,
        title: 'AwayKey App Logs',
      });
    } catch (error) {
      console.error('Error sharing logs:', error);
    }
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return '#FF5252';
      case 'warn':
        return '#FFC107';
      case 'info':
        return '#2196F3';
      default:
        return Colors.titlecolor;
    }
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'error':
        return 'close-circle';
      case 'warn':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'code-slash';
    }
  };

  const renderLogItem = ({ item }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Ionicons
          name={getLogIcon(item.level)}
          size={16}
          color={getLogColor(item.level)}
        />
        <Text style={styles.logTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
        <Text style={[styles.logLevel, { color: getLogColor(item.level) }]}>
          {item.level.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
    </View>
  );

  return (
    <AppScreen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <Text style={styles.title}>Debug Logs</Text>
        <TouchableOpacity onPress={handleClearLogs}>
          <Ionicons name="trash-outline" size={24} color="#FF5252" />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.subtitlecolor} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter logs..."
            placeholderTextColor={Colors.subtitlecolor}
            value={filter}
            onChangeText={setFilter}
          />
          {filter !== '' && (
            <TouchableOpacity onPress={() => setFilter('')}>
              <Ionicons name="close" size={20} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setAutoScroll(!autoScroll)}
          >
            <Ionicons
              name={autoScroll ? 'pause' : 'play'}
              size={20}
              color={autoScroll ? Colors.iconbackground : Colors.subtitlecolor}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopyAll}>
            <Ionicons name="copy-outline" size={20} color={Colors.iconbackground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShareLogs}>
            <Ionicons name="share-outline" size={20} color={Colors.iconbackground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          Total: {logs.length} logs
        </Text>
        {filter && (
          <Text style={styles.statsText}>
            Filtered: {logs.length} of {logCollector.getLogs().length}
          </Text>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={(item, index) => `${item.timestamp}-${index}`}
        style={styles.logsList}
        contentContainerStyle={styles.logsContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={Colors.subtitlecolor} />
            <Text style={styles.emptyText}>No logs available</Text>
            <Text style={styles.emptySubtext}>
              {filter ? 'Try changing your filter' : 'Logs will appear here as you use the app'}
            </Text>
          </View>
        }
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardbackground,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  toolbar: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.titlecolor,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Theme.spacing.md,
  },
  actionButton: {
    padding: Theme.spacing.sm,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
  },
  statsText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  logsList: {
    flex: 1,
  },
  logsContent: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  logItem: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.xs,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  logTime: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: '700',
  },
  logMessage: {
    fontSize: 14,
    color: Colors.titlecolor,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Theme.spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
});

export default DebugLogsScreen;
