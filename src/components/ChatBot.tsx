
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, Bot, User, Paperclip, Upload } from "lucide-react";
import FileUploadValidator from "./FileUploadValidator";

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  message: string;
  timestamp: Date;
  hasFile?: boolean;
  fileName?: string;
}

const ChatBot = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const handleValidFile = (validatedFile: File) => {
      setSelectedFile(validatedFile);
      toast({
        title: "Arquivo selecionado",
        description: `${validatedFile.name} está pronto para envio`,
      });
    };

    const handleInvalidFile = (error: string) => {
      console.error('File validation failed:', error);
      event.target.value = '';
    };

    // Validate file
    return <FileUploadValidator 
      file={file}
      onValid={handleValidFile}
      onInvalid={handleInvalidFile}
    />;
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || isSending) return;

    const messageToSend = newMessage.trim();
    const fileToSend = selectedFile;
    
    // Create user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: messageToSend || "Arquivo enviado para análise",
      timestamp: new Date(),
      hasFile: !!fileToSend,
      fileName: fileToSend?.name
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage("");
    setSelectedFile(null);
    setIsSending(true);

    try {
      let requestBody: any = {
        user_message: messageToSend,
        general_chat: true
      };

      // If there's a file, upload it first and include in the request
      if (fileToSend) {
        const sanitizedFileName = fileToSend.name.replace(/[<>:"/\\|?*]/g, '_');
        const fileName = `chat_${Date.now()}_${sanitizedFileName}`;
        const filePath = `chat-uploads/${fileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('contract-uploads')
          .upload(filePath, fileToSend, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        requestBody.file_path = filePath;
        requestBody.file_name = sanitizedFileName;
        requestBody.user_message = messageToSend || `Analise este arquivo: ${sanitizedFileName}`;
      }

      const { data, error } = await supabase.functions.invoke('chat-with-contract', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        message: data.ai_response || "Desculpe, não consegui processar sua mensagem.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai', 
        message: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: "Erro no chat",
        description: error.message || "Erro ao enviar mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Chat Messages */}
      <Card className="max-h-96 overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            Chat com IA Jurídica
          </CardTitle>
          <CardDescription>
            Faça perguntas sobre direito, contratos e questões jurídicas. Agora com suporte a arquivos!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Olá! Sou sua assistente jurídica virtual.</p>
              <p className="text-sm text-gray-400 mt-2">
                Faça uma pergunta sobre direito, envie um documento para análise ou combine ambos!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'user' ? (
                      <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {message.type === 'user' ? 'Você' : 'IA Jurídica'}
                      </p>
                      <p className="whitespace-pre-wrap">{message.message}</p>
                      {message.hasFile && (
                        <div className="mt-2 flex items-center text-sm opacity-75">
                          <Paperclip className="h-3 w-3 mr-1" />
                          {message.fileName}
                        </div>
                      )}
                      <p className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Input */}
      <Card>
        <CardContent className="pt-6">
          {/* File Upload Area */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Anexar arquivo (opcional)
              </label>
              {selectedFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="text-red-500 hover:text-red-700"
                >
                  Remover
                </Button>
              )}
            </div>
            
            {selectedFile ? (
              <div className="flex items-center p-3 bg-blue-50 rounded-lg border">
                <Paperclip className="h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm text-blue-700">{selectedFile.name}</span>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                <label htmlFor="chat-file-upload" className="cursor-pointer">
                  <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Clique para anexar PDF, Word, imagem ou áudio
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Máximo 10MB
                  </p>
                </label>
                <Input
                  id="chat-file-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp3,.wav,.webm,.mp4"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex space-x-2">
            <Textarea
              placeholder="Digite sua pergunta jurídica ou descreva o que quer saber sobre o arquivo..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending}
              className="min-h-[80px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={(!newMessage.trim() && !selectedFile) || isSending}
              className="self-end"
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Pressione Enter para enviar, Shift+Enter para nova linha
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatBot;
