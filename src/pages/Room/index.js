import React from 'react';
import { useParams} from 'react-router';
const Room = () => {
  const { id: roomID } = useParams();
  console.log(roomID);
  
  return(
    <div>
      Room page
    </div>
  );
}

export default Room;
