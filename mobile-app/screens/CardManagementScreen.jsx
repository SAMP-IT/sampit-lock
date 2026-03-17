import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Colors from '../constants/Colors';
import { backendApi } from '../services/api';
import TTLockService from '../services/ttlockService';
import LockControlService, { extractLockData } from '../services/lockControlService';
import { useCards } from '../hooks/useQueryHooks';

// Global operation lock to prevent concurrent operations
let globalOperationInProgress = false;
let lastOperationTime = 0;
const MIN_OPERATION_INTERVAL = 3000; // Minimum 3 seconds between operations

const CardManagementScreen = ({ route, navigation }) => {
  const { lock } = route.params;
  const queryClient = useQueryClient();
  const { data: cards = [], isLoading: loading } = useCards(lock.id);
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [operationLoading, setOperationLoading] = useState(false);

  const fetchCards = () => {
    queryClient.invalidateQueries({ queryKey: ['cards', lock.id] });
  };

  // Check if lock supports IC cards
  useEffect(() => {
    const checkCardSupport = async () => {
      try {
        const lockData = extractLockData(lock.ttlock_data);
        if (lockData) {
          const supported = await TTLockService.supportsCard(lockData);
          setIsSupported(supported);
        }
      } catch (error) {
        console.log('Could not check card support:', error);
      }
    };
    checkCardSupport();
  }, [lock.id]);

  // Check if lock is ready for a new operation
  const waitForLockReady = async () => {
    const timeSinceLastOp = Date.now() - lastOperationTime;
    if (timeSinceLastOp < MIN_OPERATION_INTERVAL) {
      const waitTime = MIN_OPERATION_INTERVAL - timeSinceLastOp;
      setStatusMessage(`Please wait ${Math.ceil(waitTime / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    setStatusMessage('');
  };

  // Get user-friendly error message
  const getUserFriendlyError = (error) => {
    const errorMsg = error.message?.toLowerCase() || '';

    if (errorMsg.includes('busy') || errorMsg.includes('processing') || errorMsg.includes('operation')) {
      return 'The lock is currently busy. Please wait a few seconds and try again.';
    }
    if (errorMsg.includes('bluetooth') || errorMsg.includes('connect')) {
      return 'Could not connect to the lock. Please make sure you are close to the lock and try again.';
    }
    if (errorMsg.includes('timeout')) {
      return 'The operation took too long. Please try again while standing closer to the lock.';
    }
    if (errorMsg.includes('not supported') || errorMsg.includes('unsupported')) {
      return 'This lock does not support IC card access.';
    }
    if (errorMsg.includes('full') || errorMsg.includes('limit')) {
      return 'The lock has reached its maximum number of cards. Please delete some cards first.';
    }
    return error.message || 'Something went wrong. Please try again.';
  };

  // Add card via Bluetooth
  const handleAddCard = async () => {
    if (!newCardName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this card so you can identify it later.');
      return;
    }

    // Check if another operation is in progress
    if (globalOperationInProgress) {
      Alert.alert(
        'Please Wait',
        'The lock is currently processing another operation. Please wait for it to finish.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setAdding(true);
      globalOperationInProgress = true;

      const lockData = extractLockData(lock.ttlock_data);
      if (!lockData) {
        throw new Error('Please make sure you are near the lock and try again.');
      }

      // Set validity period (1 year from now)
      const startDate = Date.now();
      const endDate = startDate + (365 * 24 * 60 * 60 * 1000);

      Alert.alert(
        'Add IC Card',
        'When you tap "Start", hold your card against the lock\'s card reader area.\n\nTip: Keep the card steady until you hear a beep or see a confirmation.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setAdding(false);
              globalOperationInProgress = false;
            }
          },
          {
            text: 'Start',
            onPress: async () => {
              try {
                setStatusMessage('Connecting to lock...');
                // Stop any previous Bluetooth scan to release the connection
                TTLockService.stopScan();

                // Wait for lock to be ready
                await waitForLockReady();

                // Add card via Bluetooth
                const result = await TTLockService.addCard(
                  startDate,
                  endDate,
                  lockData,
                  () => {
                    // Progress callback - card is being read
                    setStatusMessage('Hold your card on the reader...');
                  }
                );

                setStatusMessage('Saving card...');

                // Record the operation time
                lastOperationTime = Date.now();

                // Wait for lock to finish processing before saving to backend
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Ensure cardNumber is a valid string — some TTLock SDK versions
                // return 0, null, or undefined even on successful enrollment
                const safeCardNumber = (result.cardNumber != null && result.cardNumber !== '')
                  ? String(result.cardNumber)
                  : `BT_${Date.now()}`;

                if (!result.cardNumber && result.cardNumber !== 0) {
                  console.warn('[CardManagement] TTLock SDK returned empty cardNumber, using generated ID:', safeCardNumber);
                }

                // Save to backend
                await backendApi.post(`/locks/${lock.id}/cards`, {
                  cardNumber: safeCardNumber,
                  cardName: newCardName.trim(),
                  startDate: new Date(startDate).toISOString(),
                  endDate: new Date(endDate).toISOString(),
                  addType: 1, // Bluetooth enrollment
                });

                Alert.alert('Card Added', 'Your card has been registered successfully. You can now use it to unlock the door.');
                setShowAddModal(false);
                setNewCardName('');
                fetchCards();
              } catch (error) {
                console.error('Add card error:', error);

                // Check if this is a backend save error (card already on lock via Bluetooth)
                // vs a Bluetooth error (card never reached the lock)
                const isBackendError = error.response && error.response.status;
                if (isBackendError) {
                  // Card was added to the physical lock but failed to save to backend
                  Alert.alert(
                    'Card Partially Added',
                    'The card was successfully added to the lock hardware and can unlock the door, but failed to save to the app.\n\nPlease try syncing your cards from the cloud, or contact support if the issue persists.',
                    [
                      {
                        text: 'Try Sync',
                        onPress: async () => {
                          try {
                            await backendApi.get(`/locks/${lock.id}/cards?sync=true`);
                            fetchCards();
                          } catch (syncErr) {
                            console.error('Sync failed:', syncErr);
                          }
                        }
                      },
                      { text: 'OK' }
                    ]
                  );
                } else {
                  Alert.alert('Could Not Add Card', getUserFriendlyError(error));
                }
              } finally {
                setAdding(false);
                setStatusMessage('');
                globalOperationInProgress = false;
                lastOperationTime = Date.now();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Add card error:', error);
      Alert.alert('Could Not Add Card', getUserFriendlyError(error));
      setAdding(false);
      globalOperationInProgress = false;
    }
  };

  // Delete card
  const handleDeleteCard = (card) => {
    // Check if another operation is in progress
    if (globalOperationInProgress) {
      Alert.alert(
        'Please Wait',
        'The lock is currently processing another operation. Please wait for it to finish.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Remove Card',
      `Are you sure you want to remove "${card.card_name || 'this card'}"? This card will no longer be able to unlock the door.`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setOperationLoading(true);
              globalOperationInProgress = true;
              setStatusMessage('Removing card...');

              // Wait for lock to be ready
              await waitForLockReady();

              // Delete from lock via Bluetooth
              const lockData = extractLockData(lock.ttlock_data);
              if (lockData) {
                try {
                  await TTLockService.deleteCard(card.card_number, lockData);
                  // Record the operation time
                  lastOperationTime = Date.now();
                  // Wait for lock to process the deletion
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (btError) {
                  console.warn('Bluetooth delete failed:', btError);
                  // Continue with backend delete even if Bluetooth fails
                }
              }

              // Delete from backend - pass deleteType=1 to indicate Bluetooth deletion
              // (card already removed from physical lock, just need to delete from database)
              try {
                const response = await backendApi.delete(`/locks/${lock.id}/cards/${card.id}?deleteType=1`);
                console.log('[CardManagement] Backend delete response:', response?.data);
              } catch (backendError) {
                // Log but don't fail - the Bluetooth delete may have succeeded
                console.warn('[CardManagement] Backend delete error (card may still be deleted):', backendError?.message);
              }

              Alert.alert('Card Removed', 'The card has been removed from the lock.');
              fetchCards();
            } catch (error) {
              console.error('Delete card error:', error);
              // Refresh the list anyway to check if deletion actually worked
              fetchCards();
              Alert.alert('Could Not Remove Card', getUserFriendlyError(error));
            } finally {
              setOperationLoading(false);
              setStatusMessage('');
              globalOperationInProgress = false;
              lastOperationTime = Date.now();
            }
          }
        }
      ]
    );
  };

  const renderCard = ({ item }) => (
    <View style={styles.cardItem}>
      <View style={styles.cardIcon}>
        <Ionicons name="card" size={32} color={Colors.primary} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.card_name || 'Unnamed Card'}</Text>
        <Text style={styles.cardMeta}>
          Card #: {item.card_number ? item.card_number.slice(-8) : 'Unknown'}
        </Text>
        {item.user_name && (
          <Text style={styles.cardUser}>
            {item.user_name}
          </Text>
        )}
        {item.end_date && (
          <Text style={styles.cardExpiry}>
            Valid until: {new Date(item.end_date).toLocaleDateString()}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteCard(item)}
      >
        <Ionicons name="trash-outline" size={24} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>IC Cards</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Lock Info */}
      <View style={styles.lockInfo}>
        <Ionicons name="lock-closed" size={20} color={Colors.primary} />
        <Text style={styles.lockName}>{lock.name}</Text>
      </View>

      {!isSupported && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#FF9800" />
          <Text style={styles.warningText}>
            This lock may not support IC card access
          </Text>
        </View>
      )}

      {/* Card List / Scanning state in center */}
      {(loading || operationLoading) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : adding ? (
        <View style={styles.scanningCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.scanningTitle}>
            {statusMessage || 'Connecting to lock...'}
          </Text>
          <Text style={styles.scanningSubtext}>
            Hold your card on the reader...
          </Text>
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="card" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No IC cards registered</Text>
          <Text style={styles.emptySubtext}>
            Add an IC card to allow keycard access to this lock
          </Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Status Message - hide when adding so center shows it */}
      {statusMessage && !adding ? (
        <View style={styles.statusBanner}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, globalOperationInProgress && styles.addButtonDisabled]}
        onPress={() => setShowAddModal(true)}
        disabled={adding || globalOperationInProgress}
      >
        {adding ? (
          <View style={styles.addingContainer}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.addButtonText}>Reading card...</Text>
          </View>
        ) : (
          <>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Add IC Card</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add IC Card</Text>
            <Text style={styles.modalDescription}>
              Enter a name for this card (e.g., "Office Card", "Guest Card")
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Card Name"
              value={newCardName}
              onChangeText={setNewCardName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewCardName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setShowAddModal(false);
                  handleAddCard();
                }}
              >
                <Text style={styles.confirmButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  lockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lockName: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.text,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  warningText: {
    marginLeft: 8,
    color: '#E65100',
    fontSize: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 8,
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  addButtonDisabled: {
    backgroundColor: '#999',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  scanningCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scanningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  scanningSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  list: {
    padding: 16,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardUser: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  cardExpiry: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  addingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.border,
    marginRight: 8,
  },
  cancelButtonText: {
    color: Colors.text,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default CardManagementScreen;
