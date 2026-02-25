
import { supabase } from '../supabaseClient';

export const createNotification = async (
  userId: string, 
  title: string, 
  message: string, 
  type: 'info' | 'order' | 'message' | 'product' = 'info',
  link?: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title,
        message,
        type,
        link,
        is_read: false
      }]);

    if (error) throw error;
  } catch (err) {
    console.error("Error creating notification:", err);
  }
};

// Notify all admins
export const notifyAdmins = async (title: string, message: string, link?: string) => {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'irmerveilkanku@gmail.com');

    if (admins) {
      for (const admin of admins) {
        await createNotification(admin.id, title, message, 'info', link);
      }
    }
  } catch (err) {
    console.error("Error notifying admins:", err);
  }
};
