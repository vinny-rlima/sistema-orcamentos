import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Context for authentication
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('auth_token', data.token);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (error) {
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_data');
    setToken(null);
    setUser(null);
  };

  const setupAdmin = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/setup-admin`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('auth_token', data.token);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (error) {
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const apiCall = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api${url}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        logout();
        return null;
      }

      return response;
    } catch (error) {
      console.error('API call error:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout, 
      setupAdmin, 
      apiCall,
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Login Screen
const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const { login, setupAdmin } = useAuth();

  useEffect(() => {
    checkFirstTime();
  }, []);

  const checkFirstTime = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/setup-admin`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (response.status === 400 && result.detail === 'Admin já existe') {
        setIsFirstTime(false);
      } else {
        // Admin foi criado com sucesso na primeira tentativa
        setIsFirstTime(false);
      }
    } catch (error) {
      setIsFirstTime(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      alert('Erro', 'Preencha todos os campos');
      return;
    }

    setLoading(true);
    const result = await login(username, password);
    setLoading(false);

    if (!result.success) {
      alert('Erro', result.error);
    }
  };

  const handleSetupAdmin = async () => {
    setLoading(true);
    const result = await setupAdmin();
    setLoading(false);

    if (!result.success) {
      alert('Erro', result.error);
    } else {
      alert('Sucesso', 'Admin criado!');
    }
  };

  if (isFirstTime) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Ionicons name="settings-outline" size={64} color="#4A90E2" />
          <Text style={styles.loginTitle}>Configuração Inicial</Text>
          <Text style={styles.loginSubtitle}>
            Sistema não configurado. Clique para criar o administrador.
          </Text>
          <TouchableOpacity 
            style={styles.setupButton} 
            onPress={handleSetupAdmin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Configurar Sistema</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.loginContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.loginCard}>
        <Ionicons name="business-outline" size={64} color="#4A90E2" />
        <Text style={styles.loginTitle}>Sistema de Orçamentos</Text>
        <Text style={styles.loginSubtitle}>Faça login para continuar</Text>

        <TextInput
            style={styles.loginInput}
            placeholder="Usuário"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
        />

        <TextInput
            style={styles.loginInput}
            placeholder="Senha"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
        />

          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            activeOpacity={0.5}
            onPress={handleLogin}
            disabled={loading}
          >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
        
        <Text style={styles.defaultCredentials}>
          obrigado por usar!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

// Main App Component
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

const MainApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <DashboardApp />;
};

const DashboardApp = () => {
  const [stats, setStats] = useState({
    total_quotes: 0,
    total_clients: 0,
    total_value: 0
  });
  const [currentView, setCurrentView] = useState('dashboard');
  const { user, logout, isAdmin, apiCall } = useAuth();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [quotesRes, clientsRes] = await Promise.all([
        apiCall('/quotes'),
        apiCall('/clients')
      ]);

      if (quotesRes && clientsRes) {
        const quotes = await quotesRes.json();
        const clients = await clientsRes.json();
        
        const totalValue = quotes.reduce((sum, quote) => sum + quote.total, 0);

        setStats({
          total_quotes: quotes.length,
          total_clients: clients.length,
          total_value: totalValue
        });
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleLogout = () => {
  const confirmLogout = window.confirm(
    "Deseja realmente sair do sistema?"
  );

  if (confirmLogout) {
    logout();
  }
};
  const renderDashboard = () => (
    <ScrollView style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Sistema de Orçamentos</Text>
            <Text style={styles.headerSubtitle}>
              Bem-vindo, {user.username}! ({user.role === 'admin' ? 'Administrador' : 'Usuário'})
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={32} color="#4A90E2" />
            <Text style={styles.statNumber}>{stats.total_quotes}</Text>
            <Text style={styles.statLabel}>Orçamentos</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={32} color="#50C878" />
            <Text style={styles.statNumber}>{stats.total_clients}</Text>
            <Text style={styles.statLabel}>Clientes</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={32} color="#FFB347" />
            <Text style={styles.statNumber}>R$ {stats.total_value.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Valor Total</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setCurrentView('create-quote')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#4A90E2" />
            <Text style={styles.menuText}>Novo Orçamento</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setCurrentView('quotes-list')}
          >
            <Ionicons name="list-outline" size={24} color="#4A90E2" />
            <Text style={styles.menuText}>Ver Orçamentos</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setCurrentView('clients')}
          >
            <Ionicons name="people-outline" size={24} color="#50C878" />
            <Text style={styles.menuText}>Gerenciar Clientes</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setCurrentView('company-settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#FFB347" />
            <Text style={styles.menuText}>Configurações da Empresa</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity 
              style={[styles.menuItem, styles.adminMenuItem]}
              onPress={() => setCurrentView('user-management')}
            >
              <Ionicons name="person-add-outline" size={24} color="#9C27B0" />
              <Text style={styles.menuText}>Gerenciar Usuários</Text>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  );

  switch (currentView) {
    case 'create-quote':
      return <CreateQuoteScreen onBack={() => setCurrentView('dashboard')} onRefresh={loadStats} />;
    case 'quotes-list':
      return <QuotesListScreen onBack={() => setCurrentView('dashboard')} />;
    case 'clients':
      return <ClientsScreen onBack={() => setCurrentView('dashboard')} />;
    case 'company-settings':
      return <CompanySettingsScreen onBack={() => setCurrentView('dashboard')} />;
    case 'user-management':
      return isAdmin ? <UserManagementScreen onBack={() => setCurrentView('dashboard')} /> : renderDashboard();
    default:
      return renderDashboard();
  }
};

// User Management Screen (Admin only)
const UserManagementScreen = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const { apiCall } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await apiCall('/users');
      if (response && response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      alert('Preencha todos os campos');
      return;
    }

    try {
      const response = await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });

      if (response && response.ok) {
        alert('Usuário criado com sucesso!');
        setNewUser({ username: '', email: '', password: '', role: 'user' });
        setShowForm(false);
        loadUsers();
      } else {
        const error = await response.json();
        Alert.alert(error.detail || 'Erro ao criar usuário');
      }
    } catch (error) {
      Alert.alert('Erro ao criar usuário');
    }
  };

const deleteUser = async (userId) => {
  const confirmDelete = window.confirm(
    "Tem certeza que deseja excluir este usuário?"
  );

  if (!confirmDelete) return;

  try {
    const response = await apiCall(`/users/${userId}`, {
      method: 'DELETE'
    });

    console.log("STATUS:", response.status);

    const data = await response.text();
    console.log("RESPOSTA:", data);

    if (response.ok) {
      await loadUsers();
      alert("Usuário excluído com sucesso");
    } else {
      alert(data);
    }

  } catch (error) {
    console.log("ERRO:", error);
    alert("Erro ao excluir usuário");
  }
};

  if (showForm) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView>
          <SafeAreaView>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#4A90E2" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Novo Usuário</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.inputLabel}>Nome de usuário *</Text>
              <TextInput
                style={styles.input}
                value={newUser.username}
                onChangeText={(text) => setNewUser({...newUser, username: text})}
                placeholder="Nome de usuário"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>E-mail *</Text>
              <TextInput
                style={styles.input}
                value={newUser.email}
                onChangeText={(text) => setNewUser({...newUser, email: text})}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Senha *</Text>
              <TextInput
                style={styles.input}
                value={newUser.password}
                onChangeText={(text) => setNewUser({...newUser, password: text})}
                placeholder="Senha"
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Tipo de usuário</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[styles.roleButton, newUser.role === 'user' && styles.roleButtonActive]}
                  onPress={() => setNewUser({...newUser, role: 'user'})}
                >
                  <Text style={[styles.roleText, newUser.role === 'user' && styles.roleTextActive]}>
                    Usuário
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleButton, newUser.role === 'admin' && styles.roleButtonActive]}
                  onPress={() => setNewUser({...newUser, role: 'admin'})}
                >
                  <Text style={[styles.roleText, newUser.role === 'admin' && styles.roleTextActive]}>
                    Administrador
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={createUser}>
                <Text style={styles.primaryButtonText}>Criar Usuário</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Usuários</Text>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={styles.headerButton}
          >
            <Ionicons name="add" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.username}</Text>
                <Text style={styles.userDetails}>{user.email}</Text>
                <Text style={[styles.userRole, user.role === 'admin' && styles.adminRole]}>
                  {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteUser(user.id)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

// Company Settings Screen with Logo Upload
const CompanySettingsScreen = ({ onBack }) => {
  const [companyData, setCompanyData] = useState({
    company_name: '',
    cpf_cnpj: '',
    ie: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    cep: '',
    phone: '',
    phone2: '',
    email: '',
    website: '',
    logo_base64: ''
  });
  const [loading, setLoading] = useState(true);
  const { apiCall } = useAuth();

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      const response = await apiCall('/company');
      if (response && response.ok) {
        const data = await response.json();
        setCompanyData(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados da empresa:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      // For web, create a file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            setCompanyData({
              ...companyData, 
              logo_base64: readerEvent.target.result
            });
          };
          reader.readAsDataURL(file);
        }
      };
      
      input.click();
    } else {
      alert('Upload de logo disponível apenas na versão web por enquanto');
    }
  };

  const saveCompanyData = async () => {
    try {
      const response = await apiCall('/company', {
        method: 'POST',
        body: JSON.stringify(companyData)
      });

      if (response && response.ok) {
        alert('Dados da empresa salvos com sucesso!');
      } else {
        alert('Erro ao salvar dados da empresa');
      }
    } catch (error) {
      alert('Erro ao salvar dados da empresa');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView>
        <SafeAreaView>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#4A90E2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Configurações da Empresa</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Logo da Empresa</Text>
            <TouchableOpacity style={styles.logoContainer} onPress={pickImage}>
              {companyData.logo_base64 ? (
                <Image 
                  source={{ uri: companyData.logo_base64 }} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="image-outline" size={48} color="#ccc" />
                  <Text style={styles.logoPlaceholderText}>Tocar para adicionar logo</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <Text style={styles.sectionTitle}>Dados da Empresa</Text>
            
            <Text style={styles.inputLabel}>Nome da Empresa *</Text>
            <TextInput
              style={styles.input}
              value={companyData.company_name}
              onChangeText={(text) => setCompanyData({...companyData, company_name: text})}
              placeholder="Nome da empresa"
            />

            <Text style={styles.inputLabel}>CPF/CNPJ *</Text>
            <TextInput
              style={styles.input}
              value={companyData.cpf_cnpj}
              onChangeText={(text) => setCompanyData({...companyData, cpf_cnpj: text})}
              placeholder="00.000.000/0000-00"
            />

            <Text style={styles.inputLabel}>Inscrição Estadual</Text>
            <TextInput
              style={styles.input}
              value={companyData.ie}
              onChangeText={(text) => setCompanyData({...companyData, ie: text})}
              placeholder="IE"
            />

            <Text style={styles.inputLabel}>Endereço *</Text>
            <TextInput
              style={styles.input}
              value={companyData.address}
              onChangeText={(text) => setCompanyData({...companyData, address: text})}
              placeholder="Rua, número"
            />

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.inputLabel}>Bairro</Text>
                <TextInput
                  style={styles.input}
                  value={companyData.neighborhood}
                  onChangeText={(text) => setCompanyData({...companyData, neighborhood: text})}
                  placeholder="Bairro"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.inputLabel}>Cidade *</Text>
                <TextInput
                  style={styles.input}
                  value={companyData.city}
                  onChangeText={(text) => setCompanyData({...companyData, city: text})}
                  placeholder="Cidade"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.inputLabel}>Estado *</Text>
                <TextInput
                  style={styles.input}
                  value={companyData.state}
                  onChangeText={(text) => setCompanyData({...companyData, state: text})}
                  placeholder="SP"
                  maxLength={2}
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.inputLabel}>CEP</Text>
                <TextInput
                  style={styles.input}
                  value={companyData.cep}
                  onChangeText={(text) => setCompanyData({...companyData, cep: text})}
                  placeholder="00000-000"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Telefone *</Text>
            <TextInput
              style={styles.input}
              value={companyData.phone}
              onChangeText={(text) => setCompanyData({...companyData, phone: text})}
              placeholder="(11) 1111-1111"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Telefone 2</Text>
            <TextInput
              style={styles.input}
              value={companyData.phone2}
              onChangeText={(text) => setCompanyData({...companyData, phone2: text})}
              placeholder="(11) 2222-2222"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>E-mail *</Text>
            <TextInput
              style={styles.input}
              value={companyData.email}
              onChangeText={(text) => setCompanyData({...companyData, email: text})}
              placeholder="contato@empresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Website</Text>
            <TextInput
              style={styles.input}
              value={companyData.website}
              onChangeText={(text) => setCompanyData({...companyData, website: text})}
              placeholder="www.empresa.com"
              autoCapitalize="none"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={saveCompanyData}>
              <Text style={styles.primaryButtonText}>Salvar Configurações</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Simplified components for the rest - continuing with the working functionality...

// Clients Screen
const ClientsScreen = ({ onBack }) => {
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const { apiCall } = useAuth();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await apiCall('/clients');
      if (response && response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

const deleteClient = async (clientId) => {
  const confirmDelete = window.confirm(
    "Tem certeza que deseja excluir este cliente?"
  );

  if (!confirmDelete) return;

  try {
    const response = await apiCall(`/clients/${clientId}`, {
      method: 'DELETE'
    });

    if (response && response.ok) {
      loadClients();
      alert("Cliente excluído com sucesso!");
    } else {
      const error = await response.json();
      alert(error.detail || "Erro ao excluir cliente");
    }

  } catch (error) {
    console.log(error);
    alert("Erro ao excluir cliente");
  }
};

  if (showForm) {
    return (
      <ClientFormScreen
        client={editingClient}
        onBack={() => {
          setShowForm(false);
          setEditingClient(null);
          loadClients();
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Clientes</Text>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={styles.headerButton}
          >
            <Ionicons name="add" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {clients.map((client) => (
            <View key={client.id} style={styles.clientCard}>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientDetails}>{client.phone}</Text>
                <Text style={styles.clientDetails}>{client.email}</Text>
              </View>
              <View style={styles.clientActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingClient(client);
                    setShowForm(true);
                  }}
                  style={styles.actionButton}
                >
                  <Ionicons name="pencil" size={20} color="#4A90E2" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteClient(client.id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="trash" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {clients.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nenhum cliente cadastrado</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowForm(true)}
              >
                <Text style={styles.primaryButtonText}>Cadastrar Primeiro Cliente</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

// Client Form Screen (simplified for space)
const ClientFormScreen = ({ client, onBack }) => {
  const [clientData, setClientData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    phone2: client?.phone2 || '',
    email: client?.email || '',
    cpf_cnpj: client?.cpf_cnpj || '',
    rg_ie: client?.rg_ie || '',
    address: client?.address || '',
    neighborhood: client?.neighborhood || '',
    city: client?.city || '',
    state: client?.state || '',
    cep: client?.cep || '',
    company_id: '',
    created_by: ''
  });
  const { apiCall, user } = useAuth();

  const saveClient = async () => {
    if (!clientData.name || !clientData.phone || !clientData.email) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    try {
      clientData.created_by = user.id;
      
      const url = client ? `/clients/${client.id}` : '/clients';
      const method = client ? 'PUT' : 'POST';

      const response = await apiCall(url, {
        method,
        body: JSON.stringify(clientData)
      });

      if (response && response.ok) {
        alert(`Cliente ${client ? 'atualizado' : 'cadastrado'} com sucesso!`);
        onBack();
      } else {
        const error = await response.json();
        alert(error.detail || 'Erro ao salvar cliente');
      }
    } catch (error) {
      console.log(error);
      alert('Erro ao salvar cliente');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView>
        <SafeAreaView>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#4A90E2" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{client ? 'Editar Cliente' : 'Novo Cliente'}</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.inputLabel}>Nome *</Text>
            <TextInput style={styles.input} value={clientData.name} onChangeText={(text) => setClientData({...clientData, name: text})} placeholder="Nome do cliente" />
            <Text style={styles.inputLabel}>Telefone *</Text>
            <TextInput style={styles.input} value={clientData.phone} onChangeText={(text) => setClientData({...clientData, phone: text})} placeholder="(11) 1111-1111" />
            <Text style={styles.inputLabel}>E-mail *</Text>
            <TextInput style={styles.input} value={clientData.email} onChangeText={(text) => setClientData({...clientData, email: text})} placeholder="cliente@email.com" />
            <TouchableOpacity style={styles.primaryButton} onPress={saveClient}>
              <Text style={styles.primaryButtonText}>{client ? 'Atualizar Cliente' : 'Cadastrar Cliente'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Create Quote Screen with User Tracking  
const CreateQuoteScreen = ({ onBack, onRefresh }) => {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [additional, setAdditional] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [observations, setObservations] = useState('');
  const { apiCall, user } = useAuth();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await apiCall('/clients');
      if (response && response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - discount + additional;
  };

  const createQuote = async () => {
    if (!selectedClientId) {
      alert('Selecione um cliente');
      return;
    }

    if (items.some(item => !item.description)) {
      alert('Preencha a descrição de todos os itens');
      return;
    }

    try {
      const quoteData = {
        client_id: selectedClientId,
        items: items.filter(item => item.description),
        subtotal: calculateSubtotal(),
        discount,
        additional,
        total: calculateTotal(),
        payment_terms: paymentTerms,
        observations,
        company_id: '',
        created_by: user.id
      };

      const response = await apiCall('/quotes', {
        method: 'POST',
        body: JSON.stringify(quoteData)
      });

      if (response && response.ok) {
        alert('Orçamento criado com sucesso!');
        onRefresh();
        onBack();
      } else {
        alert('Erro ao criar orçamento');
      }
    } catch (error) {
      alert('Erro ao criar orçamento');
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo Orçamento</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.inputLabel}>Cliente *</Text>
          <View style={styles.pickerContainer}>
            {clients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[styles.clientOption, selectedClientId === client.id && styles.selectedOption]}
                onPress={() => setSelectedClientId(client.id)}
              >
                <Text style={styles.clientOptionText}>{client.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Itens do Orçamento</Text>
          {items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.inputLabel}>Descrição *</Text>
              <TextInput
                style={styles.input}
                value={item.description}
                onChangeText={(text) => updateItem(index, 'description', text)}
                placeholder="Descrição do produto/serviço"
              />
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.inputLabel}>Quantidade</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={item.quantity.toString()}
                    onChangeText={(text) => updateItem(index, 'quantity', parseInt(text) || 1)}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.inputLabel}>Valor Unitário</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={item.unit_price.toString()}
                    onChangeText={(text) => updateItem(index, 'unit_price', parseFloat(text) || 0)}
                    placeholder="0.00"
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
            <Ionicons name="add-circle-outline" size={24} color="#4A90E2" />
            <Text style={styles.addItemText}>Adicionar Item</Text>
          </TouchableOpacity>

          <View style={styles.totalsSection}>
            <Text style={styles.sectionTitle}>Total: R$ {calculateTotal().toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={createQuote}>
            <Text style={styles.primaryButtonText}>Criar Orçamento</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

// Quotes List Screen with User Info and Admin Delete
const QuotesListScreen = ({ onBack }) => {
  const [quotes, setQuotes] = useState([]);
  const { apiCall, isAdmin } = useAuth();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const response = await apiCall('/quotes');
      if (response && response.ok) {
        const data = await response.json();
        setQuotes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
    }
  };

  const downloadPDF = async (quoteId, quoteNumber) => {
    try {
      if (Platform.OS === 'web') {
        const pdfUrl = `${EXPO_PUBLIC_BACKEND_URL}/api/quotes/${quoteId}/pdf`;
        window.open(pdfUrl, '_blank');
      } else {
        const pdfUrl = `${EXPO_PUBLIC_BACKEND_URL}/api/quotes/${quoteId}/pdf`;
        await Linking.openURL(pdfUrl);
      }
      alert('PDF sendo baixado/aberto');
    } catch (error) {
      alert('Erro ao abrir PDF');
      console.error(error);
    }
  };

  const shareWhatsApp = (quoteNumber, total) => {
    const message = `Orçamento #${quoteNumber} - Valor: R$ ${total.toFixed(2)}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    if (Platform.OS === 'web') {
      window.open(whatsappUrl, '_blank');
    } else {
      Linking.openURL(whatsappUrl);
    }
  };

  const deleteQuote = async (quoteId) => {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir este orçamento?"
    );
  
    if (!confirmDelete) return;
  
    try {
      const response = await apiCall(`/quotes/${quoteId}`, {
        method: 'DELETE'
      });
  
      if (response && response.ok) {
        loadQuotes();
        alert("Orçamento excluído com sucesso!");
      } else {
        const error = await response.json();
        alert(error.detail || "Erro ao excluir orçamento");
      }
  
    } catch (error) {
      console.log(error);
      alert("Erro ao excluir orçamento");
    }
  };


  return (
    <ScrollView style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#4A90E2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orçamentos</Text>
        </View>

        <View style={styles.listContainer}>
          {quotes.map((quote) => (
            <View key={quote.id} style={styles.quoteCard}>
              <View style={styles.quoteHeader}>
                <View>
                  <Text style={styles.quoteNumber}>Orçamento #{quote.quote_number}</Text>
                  <Text style={styles.quoteDate}>
                    {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                  <Text style={styles.quoteUser}>
                    Criado por: {quote.created_by_name || 'Sistema'}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => deleteQuote(quote.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
              
              <Text style={styles.quoteTotal}>R$ {quote.total.toFixed(2)}</Text>
              
              <View style={styles.quoteActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => downloadPDF(quote.id, quote.quote_number)}
                >
                  <Ionicons name="download-outline" size={20} color="#4A90E2" />
                  <Text style={styles.actionText}>PDF</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => shareWhatsApp(quote.quote_number, quote.total)}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {quotes.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nenhum orçamento criado</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#343a40',
    marginTop: 16,
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  loginInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: '100%',
    marginBottom: 16,
  },
    loginButton: {
    width: '100%',
    height: 55,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5, // Android
    marginTop: 10,
  },
  setupButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  defaultCredentials: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#343a40',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  backButton: {
    padding: 8,
  },
  headerButton: {
    padding: 8,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#343a40',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  menuContainer: {
    padding: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adminMenuItem: {
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#343a40',
    marginLeft: 12,
  },
  adminBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#343a40',
    marginBottom: 16,
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#495057',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  clientOption: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  selectedOption: {
    backgroundColor: '#e3f2fd',
  },
  clientOptionText: {
    fontSize: 14,
    color: '#495057',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    flex: 0.48,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  clientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343a40',
  },
  clientDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  clientActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 16,
    marginBottom: 24,
  },
  itemRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  addItemText: {
    color: '#4A90E2',
    fontSize: 16,
    marginLeft: 8,
  },
  totalsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  quoteNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  quoteDate: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  quoteUser: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
    fontStyle: 'italic',
  },
  quoteTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 12,
  },
  quoteActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  deleteButton: {
    padding: 8,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343a40',
  },
  userDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
    fontWeight: '600',
  },
  adminRole: {
    color: '#dc3545',
  },
  roleContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  roleButtonActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  roleText: {
    fontSize: 14,
    color: '#495057',
  },
  roleTextActive: {
    color: '#fff',
  },
  logoContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 150,
    height: 100,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 100,
  },
  logoPlaceholderText: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 8,
  },
});
