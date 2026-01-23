import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import ActivityItem from '../../components/ActivityItem';
import Theme from '../../constants/Theme';
import Colors from '../../constants/Colors';
import { getAllActivity, getUsageInsights, exportActivityLogs } from '../../services/api';

const AccessLogsScreen = ({ navigation }) => {
  const [logs, setLogs] = useState([]);
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [activityResponse, insightsResponse] = await Promise.all([
          getAllActivity(),
          getUsageInsights()
        ]);
        setLogs(activityResponse.data);
        setInsights(insightsResponse.data);
      } catch (err) {
        setError("Failed to load access logs.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExport = () => {
    Alert.alert(
      'Export Activity Logs',
      'Choose export format',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'CSV',
          onPress: () => handleExportFormat('csv')
        },
        {
          text: 'PDF',
          onPress: () => handleExportFormat('pdf')
        }
      ]
    );
  };

  const handleExportFormat = async (format) => {
    setExporting(true);
    try {
      // Get the lock ID from the first log entry if available
      const lockId = logs[0]?.lockId || null;

      if (!lockId) {
        Alert.alert('Error', 'No lock data available for export');
        return;
      }

      // Call the export API
      const response = await exportActivityLogs(lockId, format);

      // Get the blob data
      const blob = response.data;

      // Create a file name with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `activity_logs_${timestamp}.${format}`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // For CSV, we can handle it as text
      if (format === 'csv') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target.result;
          await FileSystem.writeAsStringAsync(fileUri, text, {
            encoding: FileSystem.EncodingType.UTF8
          });
          await shareFile(fileUri, fileName);
        };
        reader.readAsText(blob);
      } else {
        // For PDF, handle as base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result.split(',')[1];
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64
          });
          await shareFile(fileUri, fileName);
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Export Failed',
        error.response?.data?.error?.message || 'Failed to export activity logs'
      );
    } finally {
      setExporting(false);
    }
  };

  const shareFile = async (fileUri, fileName) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: fileName.endsWith('.csv') ? 'text/csv' : 'application/pdf',
          dialogTitle: 'Export Activity Logs',
          UTI: fileName.endsWith('.csv') ? 'public.comma-separated-values-text' : 'com.adobe.pdf'
        });
        Alert.alert('Success', `Activity logs exported as ${fileName}`);
      } else {
        Alert.alert('Success', `File saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Export Saved', `File saved to ${fileUri}`);
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Access logs</Text>
          <Text style={styles.headerSubtitle}>Recent interactions with your smart locks</Text>
        </View>
        <TouchableOpacity
          onPress={handleExport}
          style={styles.exportButton}
          disabled={exporting || isLoading || logs.length === 0}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={Colors.iconbackground} />
          ) : (
            <Ionicons name="download-outline" size={24} color={logs.length === 0 ? Colors.subtitlecolor : Colors.iconbackground} />
          )}
        </TouchableOpacity>
      </View>

      <Section gapless>
        <AppCard padding="none" elevated={false}>
          {isLoading && <Text style={styles.loadingText}>Loading logs...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && logs.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </AppCard>
      </Section>

      <Section title="Insights">
        <AppCard>
          <Text style={styles.insightTitle}>Top users</Text>
          {isLoading && <Text style={styles.loadingText}>Loading insights...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && insights.map((insight) => (
            <View key={insight.userId} style={styles.insightRow}>
              <Text style={styles.insightLabel}>{insight.name}</Text>
              <Text style={styles.insightValue}>{insight.unlocks} unlocks</Text>
            </View>
          ))}
        </AppCard>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  loadingText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: Colors.subtitlecolor,
  },
  errorText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: 'red',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.sm,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
  },
  insightLabel: {
    ...Theme.typography.subtitle,
  },
  insightValue: {
    fontWeight: '600',
  },
});

export default AccessLogsScreen;
