// server/src/utils/errorHandler.js
// Mapa de mensagens de erro técnicas para mensagens amigáveis
const errorMessages = {
  // Erros de validação do Mongoose
  'ValidationError': 'Por favor, verifique os dados informados.',
  'CastError': 'Formato de dado inválido.',
  'MongoError': 'Erro ao processar operação no banco de dados.',
  
  // Erros de duplicação
  '11000': 'Este registro já existe.',
  
  // Erros de rede
  'ECONNREFUSED': 'Não foi possível conectar ao servidor. Por favor, tente novamente.',
  'ETIMEDOUT': 'A operação demorou muito para ser concluída. Por favor, tente novamente.',
  
  // Erros de autenticação
  'JsonWebTokenError': 'Sessão inválida. Por favor, faça login novamente.',
  'TokenExpiredError': 'Sua sessão expirou. Por favor, faça login novamente.',
  
  // Erros genéricos
  'GENERIC_ERROR': 'Ocorreu um erro inesperado. Por favor, tente novamente.'
};

// Função para formatar mensagens de erro
exports.formatErrorMessage = (error) => {
  // Log do erro técnico para debugging (apenas no servidor)
  console.error('Erro técnico:', error);
  
  // Retorna mensagem amigável baseada no tipo de erro
  if (error.name && errorMessages[error.name]) {
    return errorMessages[error.name];
  }
  
  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }
  
  // Para erros de validação do Mongoose, extrai mensagens específicas
  if (error.name === 'ValidationError' && error.errors) {
    const messages = Object.values(error.errors)
      .map(err => err.message)
      .filter(msg => !msg.includes('Path') && !msg.includes('`'));
    
    if (messages.length > 0) {
      return messages.join('. ');
    }
  }
  
  // Mensagem genérica como fallback
  return errorMessages.GENERIC_ERROR;
};

// Middleware de tratamento de erros global
exports.errorHandler = (err, req, res, next) => {
  // Define status code baseado no tipo de erro
  let statusCode = err.statusCode || 500;
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'CastError') {
    statusCode = 400;
  } else if (err.code === 11000) {
    statusCode = 409;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
  }
  
  // Envia resposta com mensagem amigável
  res.status(statusCode).json({
    success: false,
    message: exports.formatErrorMessage(err),
    // Apenas inclui detalhes técnicos em ambiente de desenvolvimento
    ...(process.env.NODE_ENV === 'development' && { 
      debug: {
        error: err.message,
        stack: err.stack
      }
    })
  });
};

// Função para criar erros customizados
exports.createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};