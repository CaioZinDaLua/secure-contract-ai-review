
import { useToast } from "@/hooks/use-toast";

interface FileUploadValidatorProps {
  file: File;
  onValid: (file: File) => void;
  onInvalid: (error: string) => void;
}

export const FileUploadValidator = ({ file, onValid, onInvalid }: FileUploadValidatorProps) => {
  const { toast } = useToast();

  const validateFile = () => {
    // Validações de segurança
    const validations = [
      {
        check: () => file.size <= 10 * 1024 * 1024, // 10MB
        error: "Arquivo muito grande. Máximo permitido: 10MB"
      },
      {
        check: () => file.size > 0,
        error: "Arquivo está vazio"
      },
      {
        check: () => {
          const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'audio/mpeg',
            'audio/wav',
            'audio/webm',
            'audio/mp4'
          ];
          return allowedTypes.includes(file.type);
        },
        error: "Tipo de arquivo não permitido. Use PDF, Word, imagens (JPG/PNG) ou áudio (MP3/WAV)"
      },
      {
        check: () => {
          const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.webm', '.mp4'];
          const fileName = file.name.toLowerCase();
          return allowedExtensions.some(ext => fileName.endsWith(ext));
        },
        error: "Extensão de arquivo não permitida"
      },
      {
        check: () => {
          // Verificar se o nome do arquivo contém caracteres suspeitos
          const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+=/i,
            /\.\./,
            /[<>]/
          ];
          return !suspiciousPatterns.some(pattern => pattern.test(file.name));
        },
        error: "Nome do arquivo contém caracteres não permitidos"
      },
      {
        check: () => file.name.length <= 255,
        error: "Nome do arquivo muito longo (máximo 255 caracteres)"
      }
    ];

    // Executar todas as validações
    for (const validation of validations) {
      if (!validation.check()) {
        onInvalid(validation.error);
        toast({
          title: "Arquivo inválido",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }
    }

    // Se chegou até aqui, o arquivo é válido
    onValid(file);
  };

  // Executar validação imediatamente
  validateFile();

  return null; // Este componente não renderiza nada
};

export default FileUploadValidator;
