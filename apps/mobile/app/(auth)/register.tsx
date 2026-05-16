import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, Colors, Spacing, BorderRadius } from '../../constants/theme';
import { authService, RegisterPayload } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

type Role = 'STUDENT' | 'PARENT';

const SCHOOL_LEVELS = [
  { value: 'SIXIEME', label: '6ème' },
  { value: 'CINQUIEME', label: '5ème' },
  { value: 'QUATRIEME', label: '4ème' },
  { value: 'TROISIEME', label: '3ème' },
  { value: 'SECONDE', label: 'Seconde' },
  { value: 'PREMIERE', label: 'Première' },
  { value: 'TERMINALE', label: 'Terminale' },
] as const;

type SchoolLevel = (typeof SCHOOL_LEVELS)[number]['value'];

interface Step1Data {
  email: string;
  password: string;
  confirmPassword: string;
  role: Role | null;
}

interface Step2Data {
  firstName: string;
  lastName: string;
  schoolLevel: SchoolLevel | null;
  schoolName: string;
}

export default function RegisterScreen() {
  const styles = useStyles();
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const [step1, setStep1] = useState<Step1Data>({
    email: '',
    password: '',
    confirmPassword: '',
    role: null,
  });
  const [step2, setStep2] = useState<Step2Data>({
    firstName: '',
    lastName: '',
    schoolLevel: null,
    schoolName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateStep1(): boolean {
    const next: Record<string, string> = {};
    if (!step1.email.trim()) {
      next.email = 'L\'adresse email est requise.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.email.trim())) {
      next.email = 'Adresse email invalide.';
    }
    if (!step1.password) {
      next.password = 'Le mot de passe est requis.';
    } else if (step1.password.length < 8) {
      next.password = 'Au moins 8 caractères requis.';
    }
    if (step1.password !== step1.confirmPassword) {
      next.confirmPassword = 'Les mots de passe ne correspondent pas.';
    }
    if (!step1.role) {
      next.role = 'Veuillez choisir votre profil.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2(): boolean {
    const next: Record<string, string> = {};
    if (!step2.firstName.trim()) next.firstName = 'Le prénom est requis.';
    if (!step2.lastName.trim()) next.lastName = 'Le nom est requis.';
    if (!step2.schoolLevel) next.schoolLevel = 'Le niveau scolaire est requis.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleStep1Next() {
    if (!validateStep1()) return;
    if (step1.role === 'PARENT') {
      handleRegister();
    } else {
      setStep(2);
    }
  }

  async function handleRegister() {
    if (step === 2 && !validateStep2()) return;

    setIsLoading(true);
    try {
      const payload: RegisterPayload = {
        email: step1.email.trim().toLowerCase(),
        password: step1.password,
        role: step1.role!,
        firstName: step2.firstName.trim() || 'Utilisateur',
        lastName: step2.lastName.trim() || '',
        ...(step1.role === 'STUDENT' && {
          schoolLevel: step2.schoolLevel ?? undefined,
          schoolName: step2.schoolName.trim() || undefined,
        }),
      };
      const { user, accessToken, refreshToken } = await authService.register(payload);
      await login(accessToken, refreshToken, user);
      // AuthGuard handles redirect
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        'Une erreur est survenue. Veuillez réessayer.';
      Alert.alert('Erreur d\'inscription', message);
    } finally {
      setIsLoading(false);
    }
  }

  const selectedLevel = SCHOOL_LEVELS.find((l) => l.value === step2.schoolLevel);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.logo}>EDUKDO</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? 'Crée ton compte' : 'Ton profil élève'}
          </Text>
          {/* Indicateur d'étape */}
          {step1.role === 'STUDENT' && (
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
              <View style={styles.stepLine} />
              <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            </View>
          )}
        </View>

        {step === 1 ? (
          <Step1Form
            styles={styles}
            data={step1}
            errors={errors}
            onChange={(key, value) => {
              setStep1((prev) => ({ ...prev, [key]: value }));
              if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined as any }));
            }}
            onNext={handleStep1Next}
            isLoading={isLoading}
          />
        ) : (
          <Step2Form
            styles={styles}
            data={step2}
            errors={errors}
            selectedLevelLabel={selectedLevel?.label}
            onChange={(key, value) => {
              setStep2((prev) => ({ ...prev, [key]: value }));
              if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined as any }));
            }}
            onOpenLevelPicker={() => setShowLevelPicker(true)}
            onBack={() => setStep(1)}
            onSubmit={handleRegister}
            isLoading={isLoading}
          />
        )}

        {/* Lien connexion */}
        {step === 1 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ?{' '}</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}
      </ScrollView>

      {/* Picker niveau scolaire */}
      <Modal
        visible={showLevelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLevelPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLevelPicker(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Niveau scolaire</Text>
            <FlatList
              data={SCHOOL_LEVELS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    step2.schoolLevel === item.value && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setStep2((prev) => ({ ...prev, schoolLevel: item.value }));
                    setErrors((e) => ({ ...e, schoolLevel: undefined as any }));
                    setShowLevelPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      step2.schoolLevel === item.value && styles.pickerItemTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {step2.schoolLevel === item.value && (
                    <Ionicons name="checkmark" size={18} color={Colors.gold} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

function Step1Form({
  styles,
  data,
  errors,
  onChange,
  onNext,
  isLoading,
}: {
  styles: ReturnType<typeof useStyles>;
  data: Step1Data;
  errors: Record<string, string>;
  onChange: (key: keyof Step1Data, value: string | Role) => void;
  onNext: () => void;
  isLoading: boolean;
}) {
  return (
    <View style={styles.form}>
      {/* Email */}
      <View style={styles.field}>
        <Text style={styles.label}>Adresse email</Text>
        <TextInput
          style={[styles.input, errors.email ? styles.inputError : null]}
          value={data.email}
          onChangeText={(t) => onChange('email', t)}
          placeholder="ton@email.fr"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
      </View>

      {/* Mot de passe */}
      <View style={styles.field}>
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={[styles.input, errors.password ? styles.inputError : null]}
          value={data.password}
          onChangeText={(t) => onChange('password', t)}
          placeholder="Min. 8 caractères"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
      </View>

      {/* Confirmation */}
      <View style={styles.field}>
        <Text style={styles.label}>Confirmer le mot de passe</Text>
        <TextInput
          style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
          value={data.confirmPassword}
          onChangeText={(t) => onChange('confirmPassword', t)}
          placeholder="••••••••"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
        />
        {errors.confirmPassword ? (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
        ) : null}
      </View>

      {/* Sélection du rôle */}
      <View style={styles.field}>
        <Text style={styles.label}>Je suis</Text>
        <View style={styles.roleRow}>
          <RoleCard
            styles={styles}
            label="Élève"
            emoji="🎓"
            selected={data.role === 'STUDENT'}
            onPress={() => onChange('role', 'STUDENT')}
          />
          <RoleCard
            styles={styles}
            label="Parent"
            emoji="👨‍👩‍👧"
            selected={data.role === 'PARENT'}
            onPress={() => onChange('role', 'PARENT')}
          />
        </View>
        {errors.role ? <Text style={styles.errorText}>{errors.role}</Text> : null}
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.darkBg} />
        ) : (
          <Text style={styles.buttonText}>
            {data.role === 'PARENT' ? 'Créer mon compte' : 'Suivant'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function RoleCard({
  styles,
  label,
  emoji,
  selected,
  onPress,
}: {
  styles: ReturnType<typeof useStyles>;
  label: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, selected && styles.roleCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.roleEmoji}>{emoji}</Text>
      <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Step2Form({
  styles,
  data,
  errors,
  selectedLevelLabel,
  onChange,
  onOpenLevelPicker,
  onBack,
  onSubmit,
  isLoading,
}: {
  styles: ReturnType<typeof useStyles>;
  data: Step2Data;
  errors: Record<string, string>;
  selectedLevelLabel?: string;
  onChange: (key: keyof Step2Data, value: string) => void;
  onOpenLevelPicker: () => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <View style={styles.form}>
      {/* Prénom */}
      <View style={styles.field}>
        <Text style={styles.label}>Prénom</Text>
        <TextInput
          style={[styles.input, errors.firstName ? styles.inputError : null]}
          value={data.firstName}
          onChangeText={(t) => onChange('firstName', t)}
          placeholder="Prénom"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
        />
        {errors.firstName ? (
          <Text style={styles.errorText}>{errors.firstName}</Text>
        ) : null}
      </View>

      {/* Nom */}
      <View style={styles.field}>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={[styles.input, errors.lastName ? styles.inputError : null]}
          value={data.lastName}
          onChangeText={(t) => onChange('lastName', t)}
          placeholder="Nom de famille"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
        />
        {errors.lastName ? (
          <Text style={styles.errorText}>{errors.lastName}</Text>
        ) : null}
      </View>

      {/* Niveau scolaire */}
      <View style={styles.field}>
        <Text style={styles.label}>Niveau scolaire</Text>
        <TouchableOpacity
          style={[styles.input, styles.pickerTrigger, errors.schoolLevel ? styles.inputError : null]}
          onPress={onOpenLevelPicker}
          activeOpacity={0.8}
        >
          <Text
            style={selectedLevelLabel ? styles.pickerTriggerText : styles.pickerTriggerPlaceholder}
          >
            {selectedLevelLabel ?? 'Sélectionner ton niveau'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
        {errors.schoolLevel ? (
          <Text style={styles.errorText}>{errors.schoolLevel}</Text>
        ) : null}
      </View>

      {/* Établissement (optionnel) */}
      <View style={styles.field}>
        <Text style={styles.label}>Établissement <Text style={styles.labelOptional}>(optionnel)</Text></Text>
        <TextInput
          style={styles.input}
          value={data.schoolName}
          onChangeText={(t) => onChange('schoolName', t)}
          placeholder="Nom de ton lycée ou collège"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.darkBg} />
        ) : (
          <Text style={styles.buttonText}>Créer mon compte</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const useStyles = () =>
  makeStyles(({ Colors, Spacing, BorderRadius }) => ({
    flex: {
      flex: 1,
      backgroundColor: Colors.darkBg,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xxl,
      paddingBottom: Spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    logo: {
      fontSize: 30,
      fontWeight: '800',
      color: Colors.gold,
      letterSpacing: 3,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      marginTop: Spacing.xs,
    },
    stepIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    stepDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.cardBorder,
    },
    stepDotActive: {
      backgroundColor: Colors.gold,
    },
    stepLine: {
      width: 40,
      height: 2,
      backgroundColor: Colors.cardBorder,
    },
    form: {
      gap: Spacing.md,
    },
    field: {
      gap: Spacing.xs,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    labelOptional: {
      fontWeight: '400',
      textTransform: 'none',
      color: Colors.textMuted,
    },
    input: {
      backgroundColor: Colors.cardBg,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: Colors.textPrimary,
    },
    inputError: {
      borderColor: Colors.error,
    },
    errorText: {
      fontSize: 12,
      color: Colors.error,
    },
    roleRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    roleCard: {
      flex: 1,
      backgroundColor: Colors.cardBg,
      borderWidth: 2,
      borderColor: Colors.cardBorder,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    roleCardSelected: {
      borderColor: Colors.gold,
      backgroundColor: '#1A1508',
    },
    roleEmoji: {
      fontSize: 28,
    },
    roleLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textSecondary,
    },
    roleLabelSelected: {
      color: Colors.gold,
    },
    pickerTrigger: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pickerTriggerText: {
      fontSize: 15,
      color: Colors.textPrimary,
    },
    pickerTriggerPlaceholder: {
      fontSize: 15,
      color: Colors.textMuted,
    },
    button: {
      backgroundColor: Colors.gold,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.darkBg,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
    },
    backButtonText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    footerText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.gold,
    },
    // Modal picker
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: Colors.cardBg,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxl,
      maxHeight: '60%',
    },
    pickerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    pickerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: Colors.cardBorder,
    },
    pickerItemSelected: {
      backgroundColor: '#1A1508',
    },
    pickerItemText: {
      fontSize: 16,
      color: Colors.textPrimary,
    },
    pickerItemTextSelected: {
      color: Colors.gold,
      fontWeight: '600',
    },
  }));
